"""
Main Flask Application for SPP Management System
Handles API endpoints, distribution algorithm, WebSocket sync, and Excel export
"""

import os
import json
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from functools import wraps
from io import BytesIO

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_socketio import SocketIO, emit, join_room, leave_room
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import logging

# ============================================================================
# Configuration
# ============================================================================

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Database
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    'postgresql://spp_user:spp_password@localhost:5432/spp_db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# JWT
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

# Redis
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# Initialize extensions
db = SQLAlchemy(app)
jwt = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# Database Models
# ============================================================================

class SPPElement(db.Model):
    __tablename__ = 'spp_elements'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    parent_id = db.Column(db.Integer, db.ForeignKey('spp_elements.id'))
    status = db.Column(db.String(20), default='ACTIVE')
    level = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

class Department(db.Model):
    __tablename__ = 'departments'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='ACTIVE')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class DistributionResult(db.Model):
    __tablename__ = 'distribution_results'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(255), nullable=False)
    version_date = db.Column(db.DateTime, nullable=False)
    spp_version_id = db.Column(db.Integer)
    total_amount = db.Column(db.Numeric(15, 2), nullable=False)
    distribution_data = db.Column(db.JSON, nullable=False)
    status = db.Column(db.String(20), default='SAVED')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    exported_at = db.Column(db.DateTime)
    metadata = db.Column(db.JSON)

class UserSession(db.Model):
    __tablename__ = 'user_sessions'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(255), unique=True, nullable=False)
    user_id = db.Column(db.String(255))
    jwt_token = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_activity = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)

# ============================================================================
# Distribution Algorithm
# ============================================================================

def round_to_two_decimals(value):
    """Round to 2 decimal places"""
    return round(float(value), 2)

def distribute_amount(element_ids, total_amount, db_connection=None):
    """
    Main distribution algorithm:
    1. Divide total_amount equally among selected elements
    2. Each element recursively distributes its share among children
    3. Parent nodes aggregate sums from descendants
    4. All values rounded to 2 decimal places
    """
    
    if not element_ids:
        return {}
    
    total_amount = Decimal(str(total_amount))
    amount_per_element = total_amount / len(element_ids)
    
    result = {}
    
    for element_id in element_ids:
        element = SPPElement.query.get(element_id)
        if element:
            element_distribution = _distribute_to_children(
                element,
                amount_per_element
            )
            result[element.code] = element_distribution
    
    return result

def _distribute_to_children(element, amount):
    """
    Recursively distribute amount to element and its children
    """
    # Get active children
    children = SPPElement.query.filter_by(
        parent_id=element.id,
        status='ACTIVE'
    ).all()
    
    distribution = {
        'code': element.code,
        'name': element.name,
        'amount': round_to_two_decimals(amount),
        'element_id': element.id
    }
    
    if children:
        # Distribute amount equally among children
        amount_per_child = amount / len(children)
        distribution['children'] = {}
        
        for child in children:
            child_distribution = _distribute_to_children(child, amount_per_child)
            distribution['children'][child.code] = child_distribution
    
    return distribution

def aggregate_amounts(distribution_data):
    """
    Aggregate amounts from children to parents
    """
    def aggregate_recursive(node):
        if 'children' in node and node['children']:
            total = Decimal('0')
            for child_code, child_node in node['children'].items():
                child_total = aggregate_recursive(child_node)
                total += Decimal(str(child_total))
            node['amount'] = round_to_two_decimals(total)
            return total
        else:
            return Decimal(str(node['amount']))
    
    for code, node in distribution_data.items():
        aggregate_recursive(node)
    
    return distribution_data

# ============================================================================
# API Endpoints
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Check database
        db.session.execute(db.text('SELECT 1'))
        # Check Redis
        redis_client.ping()
        return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 503

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint - simplified for demo"""
    user_id = request.json.get('user_id', f'user-{uuid.uuid4().hex[:8]}')
    session_id = str(uuid.uuid4())
    
    access_token = create_access_token(identity=user_id)
    
    # Store session
    user_session = UserSession(
        session_id=session_id,
        user_id=user_id,
        jwt_token=access_token,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.session.add(user_session)
    db.session.commit()
    
    return jsonify({
        'access_token': access_token,
        'session_id': session_id,
        'user_id': user_id
    }), 200

@app.route('/api/spp/structure', methods=['GET'])
def get_spp_structure():
    """Get current SPP hierarchical structure"""
    try:
        # Get all active root elements
        root_elements = SPPElement.query.filter_by(
            parent_id=None,
            status='ACTIVE'
        ).all()
        
        structure = []
        for element in root_elements:
            structure.append(_build_tree(element))
        
        return jsonify({
            'success': True,
            'structure': structure,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error fetching SPP structure: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

def _build_tree(element, include_inactive=False):
    """Build tree structure for element and children"""
    tree = {
        'id': element.id,
        'code': element.code,
        'name': element.name,
        'description': element.description,
        'status': element.status,
        'level': element.level
    }
    
    # Get children
    query = SPPElement.query.filter_by(parent_id=element.id)
    if not include_inactive:
        query = query.filter_by(status='ACTIVE')
    
    children = query.all()
    if children:
        tree['children'] = [_build_tree(child, include_inactive) for child in children]
    
    return tree

@app.route('/api/spp/available-dates', methods=['GET'])
def get_available_dates():
    """Get list of available dates for SPP versions"""
    try:
        conn = psycopg2.connect(
            dbname='spp_db',
            user='spp_user',
            password='spp_password',
            host='postgres'
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT DISTINCT DATE(valid_from) as version_date
            FROM spp_history
            WHERE is_current = TRUE
            ORDER BY version_date DESC
            LIMIT 30
        """)
        
        dates = [row['version_date'].isoformat() for row in cur.fetchall()]
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'dates': dates
        }), 200
    except Exception as e:
        logger.error(f"Error fetching available dates: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/distribution/calculate', methods=['POST'])
@jwt_required()
def calculate_distribution():
    """Calculate distribution of amount across selected SPP elements"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        element_ids = data.get('element_ids', [])
        total_amount = float(data.get('total_amount', 0))
        version_date = data.get('version_date')
        
        if not element_ids or total_amount <= 0:
            return jsonify({
                'success': False,
                'error': 'Invalid element_ids or total_amount'
            }), 400
        
        # Calculate distribution
        distribution_result = distribute_amount(element_ids, total_amount)
        
        # Aggregate amounts
        distribution_result = aggregate_amounts(distribution_result)
        
        # Store in Redis with TTL (24 hours)
        result_id = str(uuid.uuid4())
        redis_data = {
            'user_id': user_id,
            'timestamp': datetime.utcnow().isoformat(),
            'version_date': version_date,
            'total_amount': total_amount,
            'element_ids': element_ids,
            'distribution': distribution_result
        }
        
        redis_client.setex(
            f'distribution:{result_id}',
            86400,  # 24 hours
            json.dumps(redis_data, default=str)
        )
        
        return jsonify({
            'success': True,
            'result_id': result_id,
            'distribution': distribution_result,
            'total_amount': total_amount
        }), 200
    except Exception as e:
        logger.error(f"Error calculating distribution: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/distribution/save', methods=['POST'])
@jwt_required()
def save_distribution():
    """Save distribution result from Redis to PostgreSQL"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        result_id = data.get('result_id')
        session_id = data.get('session_id')
        
        if not result_id:
            return jsonify({'success': False, 'error': 'result_id required'}), 400
        
        # Get data from Redis
        redis_key = f'distribution:{result_id}'
        redis_data = redis_client.get(redis_key)
        
        if not redis_data:
            return jsonify({'success': False, 'error': 'Distribution result not found'}), 404
        
        redis_data = json.loads(redis_data)
        
        # Save to database
        distribution = DistributionResult(
            session_id=session_id or str(uuid.uuid4()),
            version_date=datetime.fromisoformat(redis_data['version_date']) if redis_data.get('version_date') else datetime.utcnow(),
            total_amount=redis_data['total_amount'],
            distribution_data=redis_data['distribution'],
            status='SAVED',
            metadata={
                'user_id': user_id,
                'element_ids': redis_data['element_ids']
            }
        )
        
        db.session.add(distribution)
        db.session.commit()
        
        # Notify connected clients via WebSocket
        socketio.emit('distribution_saved', {
            'result_id': str(distribution.id),
            'session_id': distribution.session_id,
            'timestamp': datetime.utcnow().isoformat()
        }, room=session_id)
        
        return jsonify({
            'success': True,
            'id': distribution.id,
            'session_id': distribution.session_id
        }), 201
    except Exception as e:
        logger.error(f"Error saving distribution: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/distribution/saved-results', methods=['GET'])
@jwt_required()
def get_saved_results():
    """Get list of saved distribution results for current session"""
    try:
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({'success': False, 'error': 'session_id required'}), 400
        
        results = DistributionResult.query.filter_by(
            session_id=session_id,
            status='SAVED'
        ).order_by(DistributionResult.created_at.desc()).all()
        
        results_data = [{
            'id': r.id,
            'total_amount': float(r.total_amount),
            'created_at': r.created_at.isoformat(),
            'version_date': r.version_date.isoformat() if r.version_date else None
        } for r in results]
        
        return jsonify({
            'success': True,
            'results': results_data
        }), 200
    except Exception as e:
        logger.error(f"Error fetching saved results: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/distribution/<int:result_id>/load', methods=['GET'])
@jwt_required()
def load_distribution(result_id):
    """Load saved distribution result"""
    try:
        result = DistributionResult.query.get(result_id)
        
        if not result:
            return jsonify({'success': False, 'error': 'Distribution result not found'}), 404
        
        return jsonify({
            'success': True,
            'id': result.id,
            'total_amount': float(result.total_amount),
            'distribution': result.distribution_data,
            'created_at': result.created_at.isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error loading distribution: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/distribution/<int:result_id>/export', methods=['GET'])
@jwt_required()
def export_distribution_excel(result_id):
    """Export distribution result as Excel file with hierarchical numbering"""
    try:
        result = DistributionResult.query.get(result_id)
        
        if not result:
            return jsonify({'success': False, 'error': 'Distribution result not found'}), 404
        
        # Create workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Distribution"
        
        # Set column widths
        ws.column_dimensions['A'].width = 15
        ws.column_dimensions['B'].width = 25
        ws.column_dimensions['C'].width = 20
        ws.column_dimensions['D'].width = 15
        
        # Header
        headers = ['Код', 'Наименование', 'Сумма', 'Уровень']
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
        
        # Data
        row = 2
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        def flatten_distribution(dist_data, prefix=''):
            nonlocal row
            
            for code, node in dist_data.items():
                # Hierarchical numbering
                level = node.get('level', 1)
                
                ws.cell(row=row, column=1, value=node['code'])
                ws.cell(row=row, column=2, value=node['name'])
                ws.cell(row=row, column=3, value=node['amount'])
                ws.cell(row=row, column=4, value=level)
                
                # Apply formatting
                for col in range(1, 5):
                    ws.cell(row=row, column=col).border = border
                
                # Indent based on level
                ws.cell(row=row, column=2).alignment = Alignment(
                    indent=level - 1,
                    horizontal="left",
                    vertical="center"
                )
                
                row += 1
                
                if 'children' in node:
                    flatten_distribution(node['children'], f'{prefix}{code}.')
        
        flatten_distribution(result.distribution_data)
        
        # Save to BytesIO
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Update export timestamp
        result.exported_at = datetime.utcnow()
        result.status = 'EXPORTED'
        db.session.commit()
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'distribution_{result_id}_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.xlsx'
        )
    except Exception as e:
        logger.error(f"Error exporting distribution: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# WebSocket Events for Real-time Sync
# ============================================================================

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'data': 'Connected to server'})

@socketio.on('join_session')
def on_join_session(data):
    """Join a user session room for real-time updates"""
    session_id = data.get('session_id')
    if session_id:
        join_room(session_id)
        emit('joined_session', {
            'session_id': session_id,
            'timestamp': datetime.utcnow().isoformat()
        })
        logger.info(f"Client {request.sid} joined session {session_id}")

@socketio.on('leave_session')
def on_leave_session(data):
    """Leave a user session room"""
    session_id = data.get('session_id')
    if session_id:
        leave_room(session_id)
        logger.info(f"Client {request.sid} left session {session_id}")

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")

# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(e):
    logger.error(f"Server error: {str(e)}")
    return jsonify({'error': 'Internal server error'}), 500

# ============================================================================
# Main
# ============================================================================

if __name__ == '__main__':
    with app.app_context():
        # Create tables if they don't exist
        db.create_all()
    
    # Run with socketio for WebSocket support
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
