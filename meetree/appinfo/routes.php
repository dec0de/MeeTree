<?php

declare(strict_types=1);

return [
    'routes' => [
        ['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
        ['name' => 'document#get', 'url' => '/document', 'verb' => 'GET'],
        ['name' => 'document#save', 'url' => '/document', 'verb' => 'PUT'],
        ['name' => 'document#newTree', 'url' => '/document/new', 'verb' => 'POST'],
        ['name' => 'document#browse', 'url' => '/browser', 'verb' => 'GET'],
        ['name' => 'document#open', 'url' => '/browser/open', 'verb' => 'POST'],
        ['name' => 'document#importDocument', 'url' => '/import', 'verb' => 'POST'],
        ['name' => 'document#importHjt', 'url' => '/import/hjt', 'verb' => 'POST'],
        ['name' => 'document#exportHjt', 'url' => '/export/hjt', 'verb' => 'GET'],
        ['name' => 'document#exportCtd', 'url' => '/export/ctd', 'verb' => 'GET'],
        ['name' => 'document#exportJson', 'url' => '/export/json', 'verb' => 'GET'],
        ['name' => 'document#search', 'url' => '/search', 'verb' => 'GET'],
    ],
];
