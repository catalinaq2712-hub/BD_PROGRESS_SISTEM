-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS mi_empresa_db;
USE mi_empresa_db;

-- ============================================
-- TABLA 1: usuarios
-- ============================================
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    edad INT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA 2: productos
-- ============================================
CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    categoria_id INT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA 3: categorias
-- ============================================
CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
);

-- ============================================
-- TABLA 4: pedidos
-- ============================================
CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10,2) DEFAULT 0,
    estado ENUM('pendiente','pagado','enviado','entregado','cancelado') DEFAULT 'pendiente',
    direccion_envio TEXT
);

-- ============================================
-- TABLA 5: detalles_pedido
-- ============================================
CREATE TABLE detalles_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- ============================================
-- TABLA 6: clientes
-- ============================================
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    telefono VARCHAR(20),
    direccion TEXT,
    ciudad VARCHAR(50),
    codigo_postal VARCHAR(10),
    pais VARCHAR(50) DEFAULT 'España'
);

-- ============================================
-- TABLA 7: empleados
-- ============================================
CREATE TABLE empleados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    puesto VARCHAR(50),
    salario DECIMAL(10,2),
    departamento_id INT,
    fecha_contratacion DATE,
    activo BOOLEAN DEFAULT TRUE
);

-- ============================================
-- TABLA 8: departamentos
-- ============================================
CREATE TABLE departamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    ubicacion VARCHAR(100),
    presupuesto DECIMAL(12,2)
);

-- ============================================
-- TABLA 9: proveedores
-- ============================================
CREATE TABLE proveedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    contacto_nombre VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion TEXT,
    ciudad VARCHAR(50)
);

-- ============================================
-- TABLA 10: inventario
-- ============================================
CREATE TABLE inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    proveedor_id INT,
    stock_actual INT DEFAULT 0,
    stock_minimo INT DEFAULT 0,
    stock_maximo INT DEFAULT 0,
    ubicacion VARCHAR(50),
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA 11: ventas
-- ============================================
CREATE TABLE ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    empleado_id INT,
    cliente_id INT,
    total DECIMAL(10,2),
    metodo_pago ENUM('efectivo','tarjeta','transferencia','paypal') DEFAULT 'efectivo'
);

-- ============================================
-- TABLA 12: detalles_venta
-- ============================================
CREATE TABLE detalles_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_venta DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(5,2) DEFAULT 0
);

-- ============================================
-- TABLA 13: facturas
-- ============================================
CREATE TABLE facturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT,
    venta_id INT,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE,
    monto_total DECIMAL(10,2),
    pagada BOOLEAN DEFAULT FALSE,
    fecha_pago DATE
);

-- ============================================
-- TABLA 14: pagos
-- ============================================
CREATE TABLE pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    factura_id INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metodo_pago VARCHAR(30),
    referencia VARCHAR(100),
    estado ENUM('pendiente','completado','fallido','reembolsado') DEFAULT 'pendiente'
);

-- ============================================
-- TABLA 15: envios
-- ============================================
CREATE TABLE envios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    empresa_transporte VARCHAR(50),
    numero_seguimiento VARCHAR(100),
    fecha_envio DATE,
    fecha_estimada_entrega DATE,
    fecha_entrega_real DATE,
    estado ENUM('preparando','enviado','en_transito','entregado','devuelto') DEFAULT 'preparando'
);

-- ============================================
-- TABLA 16: reseñas_productos
-- ============================================
CREATE TABLE reseñas_productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    usuario_id INT NOT NULL,
    puntuacion INT CHECK (puntuacion BETWEEN 1 AND 5),
    comentario TEXT,
    fecha_reseña TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aprobada BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABLA 17: cupones_descuento
-- ============================================
CREATE TABLE cupones_descuento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT,
    tipo_descuento ENUM('porcentaje','fijo') DEFAULT 'porcentaje',
    valor_descuento DECIMAL(10,2) NOT NULL,
    monto_minimo DECIMAL(10,2) DEFAULT 0,
    fecha_inicio DATE,
    fecha_fin DATE,
    usos_maximos INT DEFAULT 1,
    usos_actuales INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE
);

-- ============================================
-- TABLA 18: carrito_compras
-- ============================================
CREATE TABLE carrito_compras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sesion_id VARCHAR(100)
);

-- ============================================
-- TABLA 19: logs_sistema
-- ============================================
CREATE TABLE logs_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(50),
    registro_id INT,
    detalles TEXT,
    ip_origen VARCHAR(45),
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA 20: configuracion_sistema
-- ============================================
CREATE TABLE configuracion_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'string',
    descripcion TEXT,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- INSERTAR DATOS DE EJEMPLO
-- ============================================

-- Insertar categorías
INSERT INTO categorias (nombre, descripcion) VALUES
('Electrónica', 'Dispositivos electrónicos y accesorios'),
('Ropa', 'Prendas de vestir y accesorios de moda'),
('Hogar', 'Artículos para el hogar y decoración'),
('Deportes', 'Equipo deportivo y accesorios');

-- Insertar departamentos
INSERT INTO departamentos (nombre, ubicacion, presupuesto) VALUES
('Ventas', 'Planta baja', 150000),
('Marketing', 'Primer piso', 100000),
('TI', 'Segundo piso', 200000),
('Recursos Humanos', 'Tercer piso', 80000);

-- Insertar usuarios
INSERT INTO usuarios (nombre, email, password, edad) VALUES
('Ana García', 'ana@email.com', 'hash123', 28),
('Carlos López', 'carlos@email.com', 'hash456', 34),
('María Rodríguez', 'maria@email.com', 'hash789', 25);

-- Insertar productos
INSERT INTO productos (nombre, descripcion, precio, stock, categoria_id) VALUES
('Laptop Pro', 'Laptop de última generación', 899.99, 15, 1),
('Mouse Inalámbrico', 'Mouse ergonómico', 25.50, 50, 1),
('Camiseta Deportiva', 'Camiseta transpirable', 19.99, 100, 2),
('Lámpara LED', 'Lámpara de escritorio', 35.00, 30, 3);

-- Insertar proveedores
INSERT INTO proveedores (nombre, contacto_nombre, telefono, email, ciudad) VALUES
('TechSupply S.A.', 'Juan Pérez', '555-0101', 'juan@techsupply.com', 'Madrid'),
('FashionImport', 'Laura Gómez', '555-0202', 'laura@fashionimport.com', 'Barcelona');

-- Insertar empleados
INSERT INTO empleados (nombre, apellidos, puesto, salario, departamento_id, fecha_contratacion) VALUES
('Laura', 'Martínez', 'Vendedor', 2500, 1, '2023-01-15'),
('Pedro', 'Sánchez', 'Gerente', 4000, 1, '2022-06-01');

-- Insertar configuración del sistema
INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion) VALUES
('moneda', 'EUR', 'string', 'Moneda principal del sistema'),
('impuesto', '21', 'integer', 'IVA general en porcentaje'),
('envio_gratis_minimo', '50', 'decimal', 'Monto mínimo para envío gratis');

-- ============================================
-- CREAR RELACIONES (FOREIGN KEYS)
-- ============================================

ALTER TABLE productos ADD CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE detalles_pedido ADD CONSTRAINT fk_detalles_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
ALTER TABLE detalles_pedido ADD CONSTRAINT fk_detalles_producto FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE clientes ADD CONSTRAINT fk_clientes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE empleados ADD CONSTRAINT fk_empleados_departamento FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE SET NULL;
ALTER TABLE inventario ADD CONSTRAINT fk_inventario_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE;
ALTER TABLE inventario ADD CONSTRAINT fk_inventario_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL;
ALTER TABLE ventas ADD CONSTRAINT fk_ventas_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL;
ALTER TABLE ventas ADD CONSTRAINT fk_ventas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE detalles_venta ADD CONSTRAINT fk_detalles_venta_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE;
ALTER TABLE detalles_venta ADD CONSTRAINT fk_detalles_venta_producto FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE facturas ADD CONSTRAINT fk_facturas_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL;
ALTER TABLE facturas ADD CONSTRAINT fk_facturas_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE SET NULL;
ALTER TABLE pagos ADD CONSTRAINT fk_pagos_factura FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE;
ALTER TABLE envios ADD CONSTRAINT fk_envios_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
ALTER TABLE reseñas_productos ADD CONSTRAINT fk_reseñas_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE;
ALTER TABLE reseñas_productos ADD CONSTRAINT fk_reseñas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE carrito_compras ADD CONSTRAINT fk_carrito_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE carrito_compras ADD CONSTRAINT fk_carrito_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE;
ALTER TABLE logs_sistema ADD CONSTRAINT fk_logs_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ============================================
-- ÍNDICES PARA OPTIMIZAR CONSULTAS
-- ============================================

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_productos_precio ON productos(precio);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX idx_ventas_fecha ON ventas(fecha_venta);
CREATE INDEX idx_facturas_numero ON facturas(numero_factura);
CREATE INDEX idx_envios_seguimiento ON envios(numero_seguimiento);
CREATE INDEX idx_cupones_codigo ON cupones_descuento(codigo);
CREATE INDEX idx_logs_fecha ON logs_sistema(fecha_hora);

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- Vista de pedidos con detalles de usuario
CREATE VIEW vista_pedidos_completos AS
SELECT 
    p.id AS pedido_id,
    u.nombre AS cliente,
    p.fecha_pedido,
    p.total,
    p.estado,
    p.direccion_envio
FROM pedidos p
JOIN usuarios u ON p.usuario_id = u.id;

-- Vista de productos con stock bajo
CREATE VIEW vista_stock_bajo AS
SELECT 
    pr.nombre,
    pr.stock,
    pr.precio,
    c.nombre AS categoria
FROM productos pr
JOIN categorias c ON pr.categoria_id = c.id
WHERE pr.stock < 10;

-- ============================================
-- PROCEDIMIENTOS ALMACENADOS
-- ============================================

DELIMITER //

-- Procedimiento para actualizar stock después de una venta
CREATE PROCEDURE actualizar_stock(IN p_producto_id INT, IN p_cantidad INT)
BEGIN
    UPDATE productos 
    SET stock = stock - p_cantidad 
    WHERE id = p_producto_id AND stock >= p_cantidad;
    
    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock insuficiente';
    END IF;
END//

-- Procedimiento para registrar pedido completo
CREATE PROCEDURE registrar_pedido(
    IN p_usuario_id INT,
    IN p_direccion TEXT
)
BEGIN
    DECLARE v_pedido_id INT;
    
    INSERT INTO pedidos (usuario_id, direccion_envio, estado) 
    VALUES (p_usuario_id, p_direccion, 'pendiente');
    
    SET v_pedido_id = LAST_INSERT_ID();
    SELECT v_pedido_id AS pedido_id;
END//

DELIMITER ;

-- ============================================
-- TRIGGERS
-- ============================================

DELIMITER //

-- Trigger para actualizar total del pedido
CREATE TRIGGER actualizar_total_pedido
AFTER INSERT ON detalles_pedido
FOR EACH ROW
BEGIN
    UPDATE pedidos 
    SET total = (
        SELECT SUM(subtotal) 
        FROM detalles_pedido 
        WHERE pedido_id = NEW.pedido_id
    )
    WHERE id = NEW.pedido_id;
END//

-- Trigger para log de cambios en productos
CREATE TRIGGER log_cambios_productos
AFTER UPDATE ON productos
FOR EACH ROW
BEGIN
    INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, registro_id, detalles)
    VALUES (NULL, 'UPDATE', 'productos', NEW.id, 
            CONCAT('Precio cambiado de ', OLD.precio, ' a ', NEW.precio));
END//

DELIMITER ;

-- ============================================
-- MOSTRAR TABLAS CREADAS
-- ============================================
SHOW TABLES;

-- Consulta para verificar la estructura
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    AUTO_INCREMENT,
    CREATE_TIME
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'mi_empresa_db'
ORDER BY TABLE_NAME;