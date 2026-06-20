<?php

declare(strict_types=1);

namespace OCA\MeeTree\Service;

use OCP\Files\Folder;
use OCP\Files\IRootFolder;
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

    public function getDocument(): array {
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
        $folder = $this->getOrCreateFolder();
        $json = json_encode($this->normaliseDocument($document), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($json)) {
            throw new RuntimeException('Unable to encode MeeTree JSON document.');
        }
        try {
            $folder->get(self::DOCUMENT_FILE)->putContent($json . "\n");
        } catch (NotFoundException) {
            $folder->newFile(self::DOCUMENT_FILE, $json . "\n");
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
        $this->saveDocument($document);
        return $document;
    }

    public function importHjt(string $content): array {
        $document = $this->withMeta($this->hjtCodec->decode($content), 'hjt', 'import.hjt');
        $this->saveDocument($document);
        return $document;
    }

    public function exportHjt(): string {
        return $this->hjtCodec->encode($this->getDocument());
    }

    public function exportCtd(): string {
        return $this->ctdCodec->encode($this->getDocument());
    }

    public function exportJson(): string {
        $json = json_encode($this->getDocument(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
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

    private function getUserFolder(): Folder {
        $user = $this->userSession->getUser();
        if ($user === null) {
            throw new RuntimeException('MeeTree requires an authenticated user.');
        }

        return $this->rootFolder->getUserFolder($user->getUID());
    }
}
