<?php

declare(strict_types=1);

namespace OCA\MeeTree\Service;

use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\File;
use OCP\Files\NotFoundException;
use OCP\IUserSession;
use RuntimeException;

class DocumentService {
    private const APP_FOLDER = 'MeeTree';
    private const DOCUMENT_FILE = 'tree.meetree.json';
    private const OLD_APP_FOLDER = 'TreeMee';
    private const OLD_DOCUMENT_FILE = 'tree.treemee.json';
    private const LEGACY_DOCUMENT_FILE = 'tree.hjt';

    public function __construct(
        private IRootFolder $rootFolder,
        private IUserSession $userSession,
        private HjtCodec $hjtCodec,
        private CtdCodec $ctdCodec,
    ) {
    }

    public function getDocument(string $path = ''): array {
        if ($path !== '') {
            return $this->decodeNativeJson($this->getFile($path)->getContent());
        }

        $folder = $this->getOrCreateFolder();
        try {
            $file = $folder->get(self::DOCUMENT_FILE);
            return $this->decodeNativeJson($file->getContent());
        } catch (NotFoundException) {
            try {
                $oldFolder = $this->getUserFolder()->get(self::OLD_APP_FOLDER);
                if ($oldFolder instanceof Folder) {
                    $oldFile = $oldFolder->get(self::OLD_DOCUMENT_FILE);
                    $document = $this->decodeNativeJson($oldFile->getContent());
                    $this->saveDocument($document);
                    return $document;
                }
            } catch (NotFoundException) {
            }

            try {
                $legacyFile = $folder->get(self::LEGACY_DOCUMENT_FILE);
                $document = $this->withMeta($this->hjtCodec->decode($legacyFile->getContent()), 'hjt', self::LEGACY_DOCUMENT_FILE);
                $this->saveDocument($document);
                return $document;
            } catch (NotFoundException) {
            }

            $document = $this->withMeta($this->hjtCodec->emptyDocument(), 'json', self::DOCUMENT_FILE);
            $this->saveDocument($document);
            return $document;
        }
    }

    public function saveDocument(array $document): void {
        $document = $this->normaliseDocument($document);
        $path = (string)($document['activeFile']['path'] ?? $this->defaultDocumentPath());
        $json = json_encode($document, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($json)) {
            throw new RuntimeException('Unable to encode MeeTree JSON document.');
        }
        $this->putFileContent($path, $json . "\n");
    }

    public function listFiles(string $path): array {
        $path = $this->normalisePath($path);
        $folder = $path === '/' ? $this->getUserFolder() : $this->getFolder($path);
        $entries = [];

        foreach ($folder->getDirectoryListing() as $node) {
            if ($node instanceof Folder) {
                $entries[] = [
                    'name' => $node->getName(),
                    'path' => $this->joinPath($path, $node->getName()),
                    'type' => 'folder',
                ];
            } elseif ($node instanceof File && $this->isSupportedFilename($node->getName())) {
                $entries[] = [
                    'name' => $node->getName(),
                    'path' => $this->joinPath($path, $node->getName()),
                    'type' => 'file',
                    'format' => $this->formatFromFilename($node->getName()),
                ];
            }
        }

        usort($entries, static function (array $left, array $right): int {
            if ($left['type'] !== $right['type']) {
                return $left['type'] === 'folder' ? -1 : 1;
            }
            return strcasecmp($left['name'], $right['name']);
        });

        return [
            'path' => $path,
            'parent' => $path === '/' ? null : $this->parentPath($path),
            'entries' => $entries,
        ];
    }

    public function openFile(string $path): array {
        $path = $this->normalisePath($path);
        $file = $this->getFile($path);
        $format = $this->formatFromFilename($file->getName());
        $content = $file->getContent();

        if ($format === 'ctd') {
            $document = $this->withMeta($this->ctdCodec->decode($content), 'ctd', $file->getName());
            $document['sourceFile'] = ['path' => $path, 'format' => 'ctd'];
            return $this->saveConvertedDocument($document, $path);
        }
        if ($format === 'hjt') {
            $document = $this->withMeta($this->hjtCodec->decode($content), 'hjt', $file->getName());
            $document['sourceFile'] = ['path' => $path, 'format' => 'hjt'];
            return $this->saveConvertedDocument($document, $path);
        }

        $document = $this->decodeNativeJson($content);
        $document['activeFile'] = ['path' => $path, 'format' => 'json'];
        $document['source'] = ['format' => 'json', 'filename' => $file->getName()];
        $this->saveDocument($document);
        return $document;
    }

    private function saveConvertedDocument(array $document, string $sourcePath): array {
        $targetPath = $this->convertedPath($sourcePath);
        try {
            $document['activeFile'] = ['path' => $targetPath, 'format' => 'json'];
            $this->saveDocument($document);
            $document['message'] = 'Converted file saved as ' . $targetPath;
            return $document;
        } catch (\Throwable) {
            $fallbackPath = $this->joinPath('/' . self::APP_FOLDER, basename($targetPath));
            $document['activeFile'] = ['path' => $fallbackPath, 'format' => 'json'];
            $this->saveDocument($document);
            $document['message'] = 'Could not save beside source; converted file saved as ' . $fallbackPath;
            return $document;
        }
    }

    public function importDocument(string $filename, string $content): array {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if ($extension === 'ctd') {
            $document = $this->withMeta($this->ctdCodec->decode($content), 'ctd', $filename);
        } elseif ($extension === 'json') {
            $document = $this->decodeNativeJson($content);
        } else {
            $document = $this->withMeta($this->hjtCodec->decode($content), 'hjt', $filename);
        }
        $document['activeFile'] = ['path' => $this->joinPath('/' . self::APP_FOLDER, $this->convertedFilename($filename)), 'format' => 'json'];
        $this->saveDocument($document);
        return $document;
    }

    public function importHjt(string $content): array {
        $document = $this->withMeta($this->hjtCodec->decode($content), 'hjt', 'import.hjt');
        $document['activeFile'] = ['path' => $this->joinPath('/' . self::APP_FOLDER, $this->convertedFilename('import.hjt')), 'format' => 'json'];
        $this->saveDocument($document);
        return $document;
    }

    public function exportHjt(string $path = ''): string {
        return $this->hjtCodec->encode($this->getDocument($path));
    }

    public function exportCtd(string $path = ''): string {
        return $this->ctdCodec->encode($this->getDocument($path));
    }

    public function exportJson(string $path = ''): string {
        $json = json_encode($this->getDocument($path), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($json)) {
            throw new RuntimeException('Unable to encode MeeTree JSON document.');
        }
        return $json . "\n";
    }

    public function search(string $query, bool $titles, bool $content, bool $caseSensitive, bool $regex): array {
        $query = trim($query);
        if ($query === '' || (!$titles && !$content)) {
            return ['results' => []];
        }

        $results = [];
        $this->searchNode($this->getDocument()['root'], [], $query, $titles, $content, $caseSensitive, $regex, $results);
        return ['results' => $results];
    }

    private function searchNode(array $node, array $path, string $query, bool $titles, bool $content, bool $caseSensitive, bool $regex, array &$results): void {
        $path[] = (string)($node['title'] ?? 'Untitled');
        $matches = [];

        if ($titles && $this->matches((string)($node['title'] ?? ''), $query, $caseSensitive, $regex)) {
            $matches[] = 'title';
        }
        if ($content && $this->matches((string)($node['content'] ?? ''), $query, $caseSensitive, $regex)) {
            $matches[] = 'content';
        }

        if ($matches !== []) {
            $results[] = [
                'id' => $node['id'] ?? '',
                'title' => $node['title'] ?? 'Untitled',
                'path' => implode(' / ', $path),
                'matches' => $matches,
            ];
        }

        foreach (($node['children'] ?? []) as $child) {
            if (is_array($child)) {
                $this->searchNode($child, $path, $query, $titles, $content, $caseSensitive, $regex, $results);
            }
        }
    }

    private function matches(string $haystack, string $query, bool $caseSensitive, bool $regex): bool {
        if (!$regex) {
            return $caseSensitive ? str_contains($haystack, $query) : str_contains(mb_strtolower($haystack), mb_strtolower($query));
        }

        $pattern = '/' . str_replace('/', '\/', $query) . '/' . ($caseSensitive ? '' : 'i');
        return @preg_match($pattern, $haystack) === 1;
    }

    private function decodeNativeJson(string $content): array {
        $decoded = json_decode($content, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Invalid MeeTree JSON document.');
        }
        return $this->normaliseDocument($decoded);
    }

    private function normaliseDocument(array $document): array {
        if (!isset($document['root']) || !is_array($document['root'])) {
            $document = ['root' => $document];
        }
        $document['format'] = 'meetree';
        $document['version'] = 1;
        $document['source'] = $document['source'] ?? ['format' => 'json', 'filename' => self::DOCUMENT_FILE];
        $document['activeFile'] = $document['activeFile'] ?? ['path' => $this->defaultDocumentPath(), 'format' => 'json'];
        return $document;
    }

    private function withMeta(array $document, string $sourceFormat, string $sourceFilename): array {
        $document = $this->normaliseDocument($document);
        $document['source'] = [
            'format' => $sourceFormat,
            'filename' => $sourceFilename,
        ];
        return $document;
    }

    private function getOrCreateFolder(): Folder {
        $userFolder = $this->getUserFolder();
        try {
            $folder = $userFolder->get(self::APP_FOLDER);
        } catch (NotFoundException) {
            $folder = $userFolder->newFolder(self::APP_FOLDER);
        }

        if (!$folder instanceof Folder) {
            throw new RuntimeException('MeeTree path exists but is not a folder.');
        }

        return $folder;
    }

    private function getFolder(string $path): Folder {
        $node = $this->getUserFolder()->get(ltrim($path, '/'));
        if (!$node instanceof Folder) {
            throw new RuntimeException('Path is not a folder: ' . $path);
        }
        return $node;
    }

    private function getFile(string $path): File {
        $node = $this->getUserFolder()->get(ltrim($this->normalisePath($path), '/'));
        if (!$node instanceof File) {
            throw new RuntimeException('Path is not a file: ' . $path);
        }
        return $node;
    }

    private function putFileContent(string $path, string $content): void {
        $path = $this->normalisePath($path);
        $parent = $this->ensureFolder($this->parentPath($path));
        $name = basename($path);
        try {
            $file = $parent->get($name);
            if (!$file instanceof File) {
                throw new RuntimeException('Path exists but is not a file: ' . $path);
            }
            $file->putContent($content);
        } catch (NotFoundException) {
            $parent->newFile($name, $content);
        }
    }

    private function ensureFolder(string $path): Folder {
        $path = $this->normalisePath($path);
        if ($path === '/') {
            return $this->getUserFolder();
        }

        $current = $this->getUserFolder();
        foreach (explode('/', trim($path, '/')) as $part) {
            if ($part === '') {
                continue;
            }
            try {
                $next = $current->get($part);
            } catch (NotFoundException) {
                $next = $current->newFolder($part);
            }
            if (!$next instanceof Folder) {
                throw new RuntimeException('Path segment is not a folder: ' . $part);
            }
            $current = $next;
        }
        return $current;
    }

    private function normalisePath(string $path): string {
        $parts = [];
        foreach (explode('/', str_replace('\\', '/', $path)) as $part) {
            if ($part === '' || $part === '.') {
                continue;
            }
            if ($part === '..') {
                array_pop($parts);
                continue;
            }
            $parts[] = $part;
        }
        return '/' . implode('/', $parts);
    }

    private function joinPath(string $path, string $name): string {
        return $this->normalisePath(rtrim($path, '/') . '/' . $name);
    }

    private function parentPath(string $path): string {
        $path = $this->normalisePath($path);
        $parent = dirname($path);
        return $parent === '\\' || $parent === '.' ? '/' : $parent;
    }

    private function convertedPath(string $sourcePath): string {
        return $this->joinPath($this->parentPath($sourcePath), $this->convertedFilename(basename($sourcePath)));
    }

    private function convertedFilename(string $filename): string {
        return preg_replace('/\.(meetree\.json|json|hjt|ctd)$/i', '', $filename) . '.meetree.json';
    }

    private function defaultDocumentPath(): string {
        return $this->joinPath('/' . self::APP_FOLDER, self::DOCUMENT_FILE);
    }

    private function isSupportedFilename(string $filename): bool {
        return in_array($this->formatFromFilename($filename), ['json', 'hjt', 'ctd'], true);
    }

    private function formatFromFilename(string $filename): string {
        $lower = strtolower($filename);
        if (str_ends_with($lower, '.ctd')) {
            return 'ctd';
        }
        if (str_ends_with($lower, '.hjt')) {
            return 'hjt';
        }
        if (str_ends_with($lower, '.json')) {
            return 'json';
        }
        throw new RuntimeException('Unsupported file type: ' . $filename);
    }

    private function getUserFolder(): Folder {
        $user = $this->userSession->getUser();
        if ($user === null) {
            throw new RuntimeException('MeeTree requires an authenticated user.');
        }

        return $this->rootFolder->getUserFolder($user->getUID());
    }
}
