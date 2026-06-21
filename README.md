# Тестовое задание: Управление СПП с распределением сумм

Микросервисный модуль для управления иерархическим справочником элементов СПП с поддержкой историчности, каскадного распределения сумм и экспорта в Excel.

## 🚀 Быстрый старт

### Предварительные требования
- Docker & Docker Compose (v3.9+)
- Git

### Установка и запуск

```bash
# 1. Клонировать репозиторий
git clone https://github.com/jdfxhl/testovoe_zadanie.git
cd testovoe_zadanie

# 2. Переключиться на ветку develop
git checkout develop

# 3. Запустить приложение
docker-compose up -d

# 4. Проверить статус сервисов
docker-compose ps

# 5. Доступ к приложению
- Фронтенд: http://localhost:3000
- API (Swagger): http://localhost:5000/api/docs
- PostgreSQL: localhost:5432 (spp_user/spp_password)
- Redis: localhost:6379
```

### Остановка

```bash
docker-compose down
```

---

## 📐 Архитектура решения

### Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                      ФРОНТЕНД (Next.js/React)                   │
│  - Динамическое дерево СПП с чекбоксами                         │
│  - Выбор даты (комбобокс) для переключения версий               │
│  - Модуль распределения сумм                                    │
│  - WebSocket/SSE синхронизация между сессиями                   │
│  - Список сохранённых расчётов                                  │
│  - Скачивание Excel                                             │
└──────────────────────────────────────────────────────────────────┘
                              ↕ (REST API + WebSocket)
┌──────────────────────────────────────────────────────────────────┐
│                   БЭКЕНД (Python/Flask)                          │
│  - GET /api/spp/tree - актуальная структура дерева              │
│  - GET /api/spp/dates - доступные даты изменений                │
│  - POST /api/distribute - распределить сумму                    │
│  - POST /api/results/save - сохранить в БД из Redis             │
│  - GET /api/results - список сохранённых расчётов               │
│  - GET /api/export/{id} - Excel экспорт                         │
│  - WebSocket /ws - real-time обновления для сессии              │
└──────────────────────────────────────────────────────────────────┘
        ↕                                    ↕
    ┌─────────────────┐            ┌──────────────────┐
    │  PostgreSQL     │            │    Redis         │
    │                 │            │                  │
    │ - spp_items     │            │ Временное        │
    │ - spp_history   │            │ хранилище        │
    │ - departments   │            │ расчётов         │
    │ - dept_spp_link │            │ (TTL: 24ч)      │
    │ - results       │            │                  │
    │ - result_data   │            │                  │
    └─────────────────┘            └──────────────────┘
```

### Ключевые архитектурные решения

#### 1. **Историчность СПП (SCD Type 2 + valid_from/valid_to)**

```sql
spp_items
├── id (PK)
├── parent_id (FK) - иерархия
├── code - уникальный код элемента
├── name
├── level (1, 2, 3, ...) - уровень вложенности
├── status - 'active'/'inactive'
├── version_id (FK) - привязка к версии
├── valid_from (TIMESTAMP) - начало действия
├── valid_to (TIMESTAMP) - конец действия (NULL = текущая)
└── created_at

spp_history
├── id (PK)
├── change_date (TIMESTAMP) - дата изменения
├── version_id (FK)
└── description - тип изменения
```

**Преимущества:**
- Полная историчность структуры
- Быстрый поиск состояния на дату
- Возможность откатов
- Соответствие 3NF

#### 2. **Алгоритм каскадного распределения сумм**

```python
def distribute_amount(selected_node_ids, total_amount):
    """
    Рекурсивное распределение суммы:
    1. Делим сумму поровну между выбранными узлами
    2. Каждый узел рекурсивно распределяет свою долю потомкам
    3. Листья получают финальные суммы
    4. Родители автоматически агрегируют суммы детей
    """
    # Логика округления: до 2 знаков, перенос остатка
    # Результат сохраняется с метаданными в Redis
```

#### 3. **Redis → PostgreSQL Pipeline**

```
1. Расчёт → Redis (с TTL 24ч)
   └─ Быстрые операции, экономия памяти БД

2. Сохранение → PostgreSQL (JSONB)
   └─ Полный снимок структуры + метаданные
   └─ Связь с версией СПП и датой

3. Real-time sync → WebSocket/SSE
   └─ Оповещение активных пользователей в рамках session_id
```

#### 4. **Таблица результатов (result_data)**

```sql
result_data
├── id (PK)
├── result_id (FK)
├── session_id - для синхронизации в рамках сессии
├── spp_version_id (FK) - версия СПП, на которой расчёт
├── data (JSONB) - полный снимок:
│   ├── tree - структура с суммами
│   ├── departments - привязка отделов
│   ├── metadata
│   │   ├── calculation_date
│   │   ├── total_amount
│   │   └── calculation_params
│   └── audit
│       ├── created_at
│       └── created_by
├── status - 'calculating'/'success'/'error'
├── created_at
└── updated_at
```

---

## 🔧 Требования к окружению

```
Python:      3.11+
Node.js:     18+ (LTS)
PostgreSQL:  16+
Redis:       7+
Docker:      24.0+
Docker Compose: 2.20+
```

---

## 📁 Структура проекта

```
testovoe_zadanie/
├── docker-compose.yml          # Оркестрация сервисов
├── .env.example                # Пример переменных окружения
├── .gitignore
├── README.md                   # Этот файл
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py                  # Точка входа Flask
│   ├── config.py               # Конфигурация
│   ├── models.py               # SQLAlchemy модели
│   ├── schemas.py              # Pydantic схемы для валидации
│   ├── db/
│   │   ├── init.sql            # Инициализация схемы БД
│   │   └── demo_data.sql       # Demo-данные (3+ уровня, разные даты)
│   ├── api/
│   │   ├── __init__.py
│   │   ├── spp.py              # Endpoints: /api/spp/*
│   │   ├── distribute.py       # Endpoints: /api/distribute
│   │   ├── results.py          # Endpoints: /api/results/*
│   │   └── export.py           # Endpoints: /api/export/*
│   ├── services/
│   │   ├── __init__.py
│   │   ├── distribution_service.py  # Алгоритм распределения
│   │   ├── redis_service.py         # Работа с Redis
│   │   ├── export_service.py        # Excel экспорт (openpyxl)
│   │   └── sync_service.py          # WebSocket sync
│   └── utils/
│       ├── __init__.py
│       ├── decorators.py       # session_id валидация
│       └── helpers.py          # Утилиты
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── pages/
│   │   ├── index.tsx           # Главная страница
│   │   ├── _app.tsx            # Провайдеры, конфиг
│   │   └── api/
│   │       └── [...].ts        # Backend proxy (опционально)
│   ├── components/
│   │   ├── SPPTree.tsx         # Компонент дерева с чекбоксами
│   │   ├── DateSelector.tsx    # Комбобокс выбора даты
│   │   ├── DistributeForm.tsx  # Форма распределения суммы
│   │   ├── ResultsList.tsx     # Список сохранённых расчётов
│   │   └── ExcelExport.tsx     # Кнопка скачивания Excel
│   ├── hooks/
│   │   ├── useWebSocket.ts     # Hook для WebSocket/SSE
│   │   ├── useSPPTree.ts       # Hook управления деревом
│   │   └── useSessionSync.ts   # Hook синхронизации сессий
│   ├── services/
│   │   ├── api.ts              # API клиент (fetch/axios)
│   │   └── websocket.ts        # WebSocket клиент
│   ├── styles/
│   │   └── globals.css
│   └── utils/
│       ├── tree-helpers.ts
│       └── formatting.ts
│
└── .github/
    └── workflows/
        └── ci.yml              # CI/CD (опционально)
```

---

## 🗄️ Основные эндпоинты API

### SPP (структура)

```bash
# Получить актуальное дерево СПП
GET /api/spp/tree
Response:
{
  "id": "spp_v1",
  "items": [
    {
      "id": "1",
      "parent_id": null,
      "code": "SPP001",
      "name": "Корневой элемент",
      "level": 1,
      "status": "active",
      "children": [...]
    }
  ]
}

# Получить доступные даты для исторических срезов
GET /api/spp/dates
Response:
{
  "dates": [
    "2026-06-21T00:00:00Z",
    "2026-06-20T00:00:00Z",
    "2026-06-15T00:00:00Z"
  ]
}

# Получить дерево на конкретную дату
GET /api/spp/tree?date=2026-06-15T00:00:00Z
```

### Распределение

```bash
# Выполнить распределение суммы
POST /api/distribute
Headers: X-Session-ID: <session_id>
Body:
{
  "selected_node_ids": ["1", "2", "3"],
  "total_amount": 10000.00
}
Response:
{
  "calculation_id": "calc_abc123",
  "tree": {
    "1": {
      "amount": 3333.33,
      "children": {...}
    },
    "2": {
      "amount": 3333.33,
      "children": {...}
    },
    "3": {
      "amount": 3333.34,
      "children": {...}
    }
  },
  "redis_key": "calc:abc123",
  "ttl_seconds": 86400
}
```

### Результаты

```bash
# Сохранить расчёт из Redis в PostgreSQL
POST /api/results/save/{calculation_id}
Headers: X-Session-ID: <session_id>
Response:
{
  "result_id": "res_xyz789",
  "saved_at": "2026-06-21T12:34:56Z",
  "status": "success"
}

# Получить список сохранённых расчётов (для сессии)
GET /api/results
Headers: X-Session-ID: <session_id>
Response:
{
  "results": [
    {
      "id": "res_xyz789",
      "created_at": "2026-06-21T12:34:56Z",
      "total_amount": 10000.00,
      "spp_version_id": "spp_v1",
      "status": "success"
    }
  ]
}

# Получить детали расчёта
GET /api/results/{result_id}
Response:
{
  "id": "res_xyz789",
  "data": { /* полный JSONB снимок */ },
  "metadata": {...}
}
```

### Экспорт

```bash
# Скачать Excel по результату
GET /api/export/{result_id}
Response: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
# Плоская таблица с иерархической нумерацией, суммами, отделами
```

---

## 🔄 Real-Time синхронизация (WebSocket/SSE)

### WebSocket подход (рекомендуется)

```javascript
// Фронтенд
const ws = new WebSocket('ws://localhost:5000/ws');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'result_saved') {
    // Обновить список результатов для текущей сессии
    updateResultsList(message.data);
  }
};

// Бэкенд (Flask + flask-socketio)
@socketio.on('connect', namespace='/ws')
def handle_connect():
    session_id = request.headers.get('X-Session-ID')
    join_room(f'session_{session_id}')

@socketio.emit('result_saved', to=f'session_{session_id}')
def broadcast_result_saved(result_data):
    pass
```

---

## 💾 Demo-данные

При инициализации контейнера `postgres` выполняются два SQL-скрипта:

1. **01-schema.sql** — создание таблиц (3NF, индексы, ограничения)
2. **02-demo.sql** — заполнение демо-данными:
   - Иерархия СПП минимум 3 уровня
   - Несколько изменений с разными датами
   - Привязка отделов
   - Примеры расчётов для проверки алгоритма

---

## 🤖 Использование AI-ассистентов в разработке

### Инструменты и примеры промтов

#### 1. **GitHub Copilot** — генерация кода

**Промт:**
```
Создай Python функцию, которая рекурсивно распределяет сумму 
между узлами дерева СПП. На вход: список ID узлов, общая сумма. 
Каждый узел получает равную долю, затем распределяет свою долю 
потомкам. Листья получают финальные значения. Округлять до 2 знаков.
```

**Проверка & доработка:**
- Тестирование на граничных случаях (нечётные суммы, остатки)
- Валидация входных данных
- Логирование промежуточных результатов

#### 2. **Claude/GPT-4** — архитектурные решения

**Промт:**
```
Предложи архитектуру для хранения исторических версий иерархического 
справочника в PostgreSQL с соблюдением 3NF. Необходимо быстро 
получать состояние на любую дату, отслеживать изменения и 
поддерживать откаты. Какой подход лучше: SCD Type 2, 
таблицы версий или valid_from/valid_to?
```

**Результат:**
- Выбран гибридный подход (valid_from/valid_to + отдельная таблица версий)
- Создана схема с индексами для быстрого поиска по датам
- Написана миграция

#### 3. **ChatGPT** — документация и примеры

**Промт:**
```
Напиши для README.md раздел "Архитектура решения" с диаграммой 
потока данных Redis → PostgreSQL, объяснением алгоритма распределения 
и примерами эндпоинтов API. Используй ASCII диаграммы и таблицы.
```

**Интеграция:**
- Материал адаптирован под проект
- Добавлены реальные имена таблиц и эндпоинтов
- Проверены примеры кода

---

## ✅ Контрольные точки качества

### Код
- ✓ Unit-тесты для алгоритма распределения
- ✓ Integration-тесты для API
- ✓ Type hints во всём Python коде
- ✓ ESLint + Prettier для TypeScript/React

### БД
- ✓ Все таблицы в 3NF
- ✓ Индексы на часто используемые поля (parent_id, valid_to, session_id)
- ✓ Foreign keys с каскадным удалением

### Фронтенд
- ✓ Синхронизация без перезагрузки страницы
- ✓ Обработка сетевых ошибок
- ✓ Loading states и скелеты

### DevOps
- ✓ Healthchecks для всех сервисов
- ✓ Логирование в stdout
- ✓ Graceful shutdown

---

## 📊 Метрики и логирование

```python
# Бэкенд логирует:
- Время выполнения распределения
- Кол-во обработанных узлов
- Ошибки валидации
- WebSocket коннекты/дисконнекты
- Сохранения в БД

# Фронтенд отслеживает:
- Время загрузки дерева
- Ошибки API
- WebSocket reconnect attempts
```

---

## 🐛 Troubleshooting

### PostgreSQL не стартует

```bash
docker-compose logs postgres
# Проверить: синтаксис SQL, права доступа, свободное место
```

### Redis connection refused

```bash
docker-compose restart redis
docker-compose logs redis
```

### API не отвечает

```bash
docker-compose logs backend
# Проверить DATABASE_URL и REDIS_URL
```

---

## 📝 Лицензия

MIT

---

## 👤 Автор

Разработано как тестовое задание с активным использованием AI-ассистентов для ускорения разработки, тестирования и документации.

**Контакт:** jdfxhl@github.com
