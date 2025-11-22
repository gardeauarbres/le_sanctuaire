<?php
/**
 * Backend de tracking - Gard Eau Arbres
 * Sécurisé avec validation et sanitization
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Limiter les requêtes (rate limiting basique)
session_start();
if (!isset($_SESSION['last_request'])) {
    $_SESSION['last_request'] = 0;
    $_SESSION['request_count'] = 0;
}

$now = time();
if ($now - $_SESSION['last_request'] > 60) {
    $_SESSION['request_count'] = 0;
    $_SESSION['last_request'] = $now;
}

$_SESSION['request_count']++;
if ($_SESSION['request_count'] > 100) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'Too many requests']);
    exit;
}

// Validation de la méthode
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

// Validation et sanitization des données
$input = json_decode(file_get_contents('php://input'), true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
    exit;
}

$type = isset($input['type']) ? trim($input['type']) : null;
$id = isset($input['id']) ? trim($input['id']) : '';

// Validation du type
$allowedTypes = ['visit', 'tree', 'sponsor', 'plant_view'];
if (!$type || !in_array($type, $allowedTypes)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid type']);
    exit;
}

// Sanitization de l'ID (alphanumérique, tirets, underscores uniquement)
$id = preg_replace('/[^a-z0-9_\-]/i', '', $id);
$id = substr($id, 0, 50); // Limiter la longueur

// Configuration de la base de données
$dbFile = __DIR__ . '/data.sqlite';
$dbDir = dirname($dbFile);

// Vérifier que le répertoire est accessible en écriture
if (!is_writable($dbDir)) {
    error_log("Database directory not writable: $dbDir");
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server configuration error']);
    exit;
}

try {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
    // Créer la table si nécessaire
    $pdo->exec('CREATE TABLE IF NOT EXISTS counts (
        k TEXT PRIMARY KEY,
        v INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\'))
    )');
    
    // Créer index pour les performances
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_updated ON counts(updated_at)');
    
    // Construire la clé
    $key = $type . ($id ? ':' . $id : '');
    
    // Préparer et exécuter la requête
    $stmt = $pdo->prepare('INSERT INTO counts(k, v, updated_at) VALUES(:k, 1, strftime(\'%s\', \'now\'))
        ON CONFLICT(k) DO UPDATE SET v = v + 1, updated_at = strftime(\'%s\', \'now\')');
    
    $stmt->execute([':k' => $key]);
    
    // Retourner la réponse
    echo json_encode([
        'ok' => true,
        'key' => $key,
        'timestamp' => time()
    ]);
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database error']);
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server error']);
}
