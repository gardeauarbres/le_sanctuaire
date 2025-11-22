<?php
/**
 * Backend de statistiques - Gard Eau Arbres
 * Sécurisé avec validation
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Validation de la méthode
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$dbFile = __DIR__ . '/data.sqlite';

// Vérifier que le fichier existe
if (!file_exists($dbFile)) {
    echo json_encode(['ok' => true, 'counts' => []]);
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
    
    // Récupérer les statistiques
    $stmt = $pdo->query('SELECT k, v, updated_at FROM counts ORDER BY updated_at DESC');
    $rows = $stmt->fetchAll();
    
    $out = [];
    foreach ($rows as $r) {
        $out[$r['k']] = [
            'count' => (int)$r['v'],
            'updated_at' => (int)$r['updated_at']
        ];
    }
    
    echo json_encode([
        'ok' => true,
        'counts' => $out,
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
