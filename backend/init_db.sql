-- ============================================================================
-- PostgreSQL Schema Initialization: SPP Hierarchical Directory Management
-- ============================================================================

-- 1. SPP Elements (Hierarchical Dictionary)
CREATE TABLE spp_elements (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id INT REFERENCES spp_elements(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    level INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SPP History (SCD Type 2 - tracks changes over time)
CREATE TABLE spp_history (
    id SERIAL PRIMARY KEY,
    element_id INT NOT NULL REFERENCES spp_elements(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id INT,
    status VARCHAR(20) NOT NULL,
    level INT NOT NULL,
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP,
    is_current BOOLEAN DEFAULT TRUE,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Departments Directory
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. SPP Element - Department Binding
CREATE TABLE spp_department_bindings (
    id SERIAL PRIMARY KEY,
    spp_element_id INT NOT NULL REFERENCES spp_elements(id) ON DELETE CASCADE,
    department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    binding_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP,
    UNIQUE(spp_element_id, department_id, valid_from)
);

-- 5. Distribution Results Storage
CREATE TABLE distribution_results (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    version_date TIMESTAMP NOT NULL,
    spp_version_id INT REFERENCES spp_history(id),
    total_amount NUMERIC(15, 2) NOT NULL,
    distribution_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SAVED' CHECK (status IN ('PENDING', 'SAVED', 'EXPORTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exported_at TIMESTAMP,
    metadata JSONB
);

-- 6. Distribution Sessions (for real-time sync)
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255),
    jwt_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_spp_elements_parent ON spp_elements(parent_id);
CREATE INDEX idx_spp_elements_status ON spp_elements(status);
CREATE INDEX idx_spp_elements_level ON spp_elements(level);
CREATE INDEX idx_spp_history_element ON spp_history(element_id);
CREATE INDEX idx_spp_history_valid ON spp_history(valid_from, valid_to);
CREATE INDEX idx_spp_history_current ON spp_history(is_current);
CREATE INDEX idx_spp_department_bindings_element ON spp_department_bindings(spp_element_id);
CREATE INDEX idx_spp_department_bindings_department ON spp_department_bindings(department_id);
CREATE INDEX idx_distribution_results_session ON distribution_results(session_id);
CREATE INDEX idx_distribution_results_version_date ON distribution_results(version_date);
CREATE INDEX idx_distribution_results_created ON distribution_results(created_at);
CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);

-- Function to update SPP history on element change
CREATE OR REPLACE FUNCTION update_spp_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Close previous version
    UPDATE spp_history 
    SET valid_to = CURRENT_TIMESTAMP, is_current = FALSE
    WHERE element_id = NEW.id AND is_current = TRUE;
    
    -- Create new history record
    INSERT INTO spp_history (element_id, code, name, description, parent_id, status, level, valid_from, is_current)
    VALUES (NEW.id, NEW.code, NEW.name, NEW.description, NEW.parent_id, NEW.status, NEW.level, CURRENT_TIMESTAMP, TRUE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for SPP elements history
CREATE TRIGGER spp_elements_history_trigger
AFTER UPDATE ON spp_elements
FOR EACH ROW
EXECUTE FUNCTION update_spp_history();

-- Function to update modified timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER spp_elements_timestamp
BEFORE UPDATE ON spp_elements
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER departments_timestamp
BEFORE UPDATE ON departments
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER user_sessions_activity
BEFORE UPDATE ON user_sessions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

COMMIT;
