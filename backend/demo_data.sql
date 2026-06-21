-- ============================================================================
-- Demo Data: SPP Hierarchical Structure with 3+ Levels
-- ============================================================================

-- Рекурсивная функция получения всех потомков заданного элемента (любая глубина)
CREATE OR REPLACE FUNCTION get_descendants(root_id INT)
RETURNS TABLE(id INT)
LANGUAGE SQL
AS $$
    WITH RECURSIVE descendants AS (
        SELECT id FROM spp_elements WHERE parent_id = root_id
        UNION ALL
        SELECT e.id FROM spp_elements e
        INNER JOIN descendants d ON e.parent_id = d.id
    )
    SELECT id FROM descendants;
$$;

-- 1. Insert SPP Elements (Hierarchical Structure - 4 levels)
-- Level 1: Root Categories
INSERT INTO spp_elements (code, name, description, parent_id, status, level) VALUES
('SPP-001', 'Производство', 'Производственные направления', NULL, 'ACTIVE', 1),
('SPP-002', 'Администрация', 'Административные услуги', NULL, 'ACTIVE', 1),
('SPP-003', 'Логистика', 'Логистические операции', NULL, 'ACTIVE', 1);

-- Level 2: Sub-categories
INSERT INTO spp_elements (code, name, description, parent_id, status, level) VALUES
-- Under Производство
('SPP-001-001', 'Механическая обработка', 'Механическая обработка деталей', 1, 'ACTIVE', 2),
('SPP-001-002', 'Сборка', 'Сборочные работы', 1, 'ACTIVE', 2),
('SPP-001-003', 'Контроль качества', 'Контроль качества продукции', 1, 'INACTIVE', 2),

-- Under Администрация
('SPP-002-001', 'Финансы', 'Финансовые операции', 2, 'ACTIVE', 2),
('SPP-002-002', 'Кадры', 'Управление персоналом', 2, 'ACTIVE', 2),
('SPP-002-003', 'Документооборот', 'Управление документами', 2, 'ACTIVE', 2),

-- Under Логистика
('SPP-003-001', 'Склад', 'Складские операции', 3, 'ACTIVE', 2),
('SPP-003-002', 'Доставка', 'Доставка товаров', 3, 'ACTIVE', 2);

-- Level 3: Detailed operations
INSERT INTO spp_elements (code, name, description, parent_id, status, level) VALUES
-- Under Механическая обработка
('SPP-001-001-001', 'Фрезеровка', 'Операция фрезеровки', 4, 'ACTIVE', 3),
('SPP-001-001-002', 'Токарная обработка', 'Токарные работы', 4, 'ACTIVE', 3),
('SPP-001-001-003', 'Шлифовка', 'Шлифовальные работы', 4, 'ACTIVE', 3),

-- Under Сборка
('SPP-001-002-001', 'Узловая сборка', 'Сборка узлов и модулей', 5, 'ACTIVE', 3),
('SPP-001-002-002', 'Финальная сборка', 'Финальная сборка изделий', 5, 'ACTIVE', 3),

-- Under Финансы
('SPP-002-001-001', 'Расчеты', 'Финансовые расчеты', 7, 'ACTIVE', 3),
('SPP-002-001-002', 'Аудит', 'Финансовый аудит', 7, 'ACTIVE', 3),

-- Under Кадры
('SPP-002-002-001', 'Подбор', 'Подбор персонала', 8, 'ACTIVE', 3),
('SPP-002-002-002', 'Обучение', 'Обучение персонала', 8, 'ACTIVE', 3),

-- Under Склад
('SPP-003-001-001', 'Приемка', 'Приемка товаров', 11, 'ACTIVE', 3),
('SPP-003-001-002', 'Размещение', 'Размещение на полках', 11, 'ACTIVE', 3),
('SPP-003-001-003', 'Отпуск', 'Отпуск со склада', 11, 'ACTIVE', 3),

-- Under Доставка
('SPP-003-002-001', 'Упаковка', 'Упаковка товаров', 12, 'ACTIVE', 3),
('SPP-003-002-002', 'Транспортировка', 'Транспортировка товаров', 12, 'ACTIVE', 3),
('SPP-003-002-003', 'Распределение', 'Распределение в регионы', 12, 'ACTIVE', 3);

-- 2. Insert Initial History Records (текущая версия)
INSERT INTO spp_history (element_id, code, name, description, parent_id, status, level, valid_from, is_current)
SELECT id, code, name, description, parent_id, status, level, CURRENT_TIMESTAMP, TRUE
FROM spp_elements;

-- ============================================================================
-- Исторические срезы с автоматической деактивацией всех потомков
-- ============================================================================

-- Версия от 60 дней назад: деактивируем ветки "Механическая обработка", "Сборка", "Кадры"
INSERT INTO spp_history (element_id, code, name, description, parent_id, status, level, valid_from, is_current)
SELECT
    e.id,
    e.code,
    e.name,
    e.description,
    e.parent_id,
    CASE
        WHEN e.id IN (4,5,8)
             OR e.id IN (SELECT id FROM get_descendants(4))
             OR e.id IN (SELECT id FROM get_descendants(5))
             OR e.id IN (SELECT id FROM get_descendants(8))
        THEN 'INACTIVE'
        ELSE e.status
    END AS status,
    e.level,
    CURRENT_TIMESTAMP - INTERVAL '60 days',
    FALSE
FROM spp_elements e;

-- Версия от 30 дней назад: деактивируем всю Логистику (id=3) и всех её потомков
INSERT INTO spp_history (element_id, code, name, description, parent_id, status, level, valid_from, is_current)
SELECT
    e.id,
    e.code,
    e.name,
    e.description,
    e.parent_id,
    CASE
        WHEN e.id = 3
             OR e.id IN (SELECT id FROM get_descendants(3))
        THEN 'INACTIVE'
        ELSE e.status
    END AS status,
    e.level,
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    FALSE
FROM spp_elements e;

-- Версия от 10 дней назад: все элементы активны, плюс новый элемент "Сверловка"
INSERT INTO spp_elements (code, name, description, parent_id, status, level)
VALUES ('SPP-001-001-004', 'Сверловка', 'Сверлильные работы', 4, 'ACTIVE', 3);

INSERT INTO spp_history (element_id, code, name, description, parent_id, status, level, valid_from, is_current)
SELECT id, code, name, description, parent_id, status, level, CURRENT_TIMESTAMP - INTERVAL '10 days', FALSE
FROM spp_elements;

-- 4. Insert Departments
INSERT INTO departments (code, name, description, status) VALUES
('DEPT-001', 'Отдел производства', 'Основной производственный отдел', 'ACTIVE'),
('DEPT-002', 'Отдел контроля качества', 'Отдел обеспечения качества', 'ACTIVE'),
('DEPT-003', 'Отдел логистики', 'Отдел логистического управления', 'ACTIVE'),
('DEPT-004', 'Финансовый отдел', 'Отдел финансов и учета', 'ACTIVE'),
('DEPT-005', 'Кадровый отдел', 'Отдел управления персоналом', 'ACTIVE');

-- 5. Insert SPP - Department Bindings
INSERT INTO spp_department_bindings (spp_element_id, department_id, valid_from) VALUES
(1, 1, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(4, 1, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(5, 1, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(6, 2, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(2, 4, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(2, 5, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(7, 4, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(8, 5, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(9, 5, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(3, 3, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(11, 3, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(12, 3, CURRENT_TIMESTAMP - INTERVAL '30 days');

-- 6. Insert Sample Distribution Results
INSERT INTO distribution_results (session_id, version_date, spp_version_id, total_amount, distribution_data, status, created_at, metadata) VALUES
('session-2026-06-20-001', CURRENT_TIMESTAMP - INTERVAL '1 day', 1, 100000.00,
'{
  "SPP-001": {
    "code": "SPP-001",
    "name": "Производство",
    "amount": 50000.00,
    "children": {
      "SPP-001-001": {
        "code": "SPP-001-001",
        "name": "Механическая обработка",
        "amount": 25000.00,
        "children": {
          "SPP-001-001-001": {"code": "SPP-001-001-001", "name": "Фрезеровка", "amount": 8333.33},
          "SPP-001-001-002": {"code": "SPP-001-001-002", "name": "Токарная обработка", "amount": 8333.33},
          "SPP-001-001-003": {"code": "SPP-001-001-003", "name": "Шлифовка", "amount": 8333.34}
        }
      },
      "SPP-001-002": {
        "code": "SPP-001-002",
        "name": "Сборка",
        "amount": 25000.00,
        "children": {
          "SPP-001-002-001": {"code": "SPP-001-002-001", "name": "Узловая сборка", "amount": 12500.00},
          "SPP-001-002-002": {"code": "SPP-001-002-002", "name": "Финальная сборка", "amount": 12500.00}
        }
      }
    }
  },
  "SPP-002": {
    "code": "SPP-002",
    "name": "Администрация",
    "amount": 30000.00
  },
  "SPP-003": {
    "code": "SPP-003",
    "name": "Логистика",
    "amount": 20000.00
  }
}',
'SAVED', CURRENT_TIMESTAMP - INTERVAL '1 day',
'{"user_id": "user-001", "department_ids": [1, 2, 3]}'),

('session-2026-06-20-002', CURRENT_TIMESTAMP - INTERVAL '2 days', 1, 250000.00,
'{
  "SPP-001": {"code": "SPP-001", "name": "Производство", "amount": 150000.00},
  "SPP-002": {"code": "SPP-002", "name": "Администрация", "amount": 75000.00},
  "SPP-003": {"code": "SPP-003", "name": "Логистика", "amount": 25000.00}
}',
'SAVED', CURRENT_TIMESTAMP - INTERVAL '2 days',
'{"user_id": "user-002", "department_ids": [1, 3, 4, 5]}');

-- 7. Insert Sample User Sessions
INSERT INTO user_sessions (session_id, user_id, created_at, last_activity, expires_at) VALUES
('session-2026-06-20-001', 'user-001', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '7 days'),
('session-2026-06-20-002', 'user-002', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP + INTERVAL '7 days'),
('session-2026-06-21-current', 'user-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days');

-- 8. Create view for current SPP structure
CREATE VIEW v_current_spp_structure AS
SELECT 
    e.id,
    e.code,
    e.name,
    e.description,
    e.parent_id,
    e.status,
    e.level,
    COALESCE(d.dept_count, 0) as department_count
FROM spp_elements e
LEFT JOIN (
    SELECT spp_element_id, COUNT(*) as dept_count
    FROM spp_department_bindings
    WHERE valid_to IS NULL
    GROUP BY spp_element_id
) d ON e.id = d.spp_element_id
WHERE e.status = 'ACTIVE'
ORDER BY e.level, e.code;

COMMIT;