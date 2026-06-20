<?php

declare(strict_types=1);

namespace OCA\MeeTree\Service;

use InvalidArgumentException;

class HjtCodec {
    private const HEADER = '<Treepad version 2.7>';
    private const END_NODE = '<end node> 5P9i0s8y19Z';

    public function decode(string $hjt): array {
        $lines = preg_split('/\r\n|\r|\n/', $hjt);
        if ($lines === false || $lines === []) {
            throw new InvalidArgumentException('Unable to read HJT content.');
        }

        $index = 0;
        if (isset($lines[0]) && str_starts_with(trim($lines[0]), '<Treepad')) {
            $index = 1;
        }

        $root = [
            'id' => $this->newId(),
            'title' => 'HJT document',
            'content' => '',
            'children' => [],
        ];
        $stack = [];
        while ($index < count($lines)) {
            while ($index < count($lines) && trim((string)$lines[$index]) === '') {
                $index++;
            }
            if ($index >= count($lines)) {
                break;
            }

            if (strtolower(trim((string)$lines[$index])) === 'dt=text') {
                $index++;
            }
            if (($lines[$index] ?? null) !== '<node>') {
                throw new InvalidArgumentException('Expected <node> at HJT line ' . ($index + 1) . '.');
            }

            $title = (string)($lines[++$index] ?? 'Untitled');
            $depthLine = (string)($lines[++$index] ?? '0');
            while (!preg_match('/^\d+$/', $depthLine) && isset($lines[$index + 1])) {
                $title .= ' ' . $depthLine;
                $depthLine = (string)$lines[++$index];
            }
            $depth = (int)$depthLine;
            $index++;

            $content = [];
            while ($index < count($lines) && $lines[$index] !== self::END_NODE) {
                $content[] = (string)$lines[$index];
                $index++;
            }
            if ($index >= count($lines)) {
                throw new InvalidArgumentException('Missing HJT end node marker.');
            }
            $index++;

            $node = [
                'id' => $this->newId(),
                'title' => $title,
                'content' => implode("\n", $content),
                'children' => [],
            ];

            if ($depth === 0) {
                $root['children'][] = $node;
                $childIndex = count($root['children']) - 1;
                $stack[0] = &$root['children'][$childIndex];
                foreach (array_keys($stack) as $stackDepth) {
                    if ($stackDepth > 0) {
                        unset($stack[$stackDepth]);
                    }
                }
                continue;
            }

            if (!isset($stack[$depth - 1])) {
                throw new InvalidArgumentException('Invalid HJT depth at node "' . $title . '".');
            }
            $parent = &$stack[$depth - 1];
            $parent['children'][] = $node;
            $childIndex = count($parent['children']) - 1;
            $stack[$depth] = &$parent['children'][$childIndex];
            foreach (array_keys($stack) as $stackDepth) {
                if ($stackDepth > $depth) {
                    unset($stack[$stackDepth]);
                }
            }
        }

        if ($root['children'] === []) {
            return $this->emptyDocument();
        }

        if (count($root['children']) === 1) {
            return ['root' => $root['children'][0]];
        }

        return ['root' => $root];
    }

    public function encode(array $document): string {
        $root = $document['root'] ?? $this->emptyDocument()['root'];
        $output = self::HEADER . "\n";
        $this->encodeNode($root, 0, $output);
        return $output;
    }

    public function emptyDocument(): array {
        return [
            'root' => [
                'id' => $this->newId(),
                'title' => '<Untitled node>',
                'content' => date('M j, Y'),
                'children' => [],
            ],
        ];
    }

    private function encodeNode(array $node, int $depth, string &$output): void {
        $title = str_replace(["\r", "\n"], ' ', (string)($node['title'] ?? 'Untitled'));
        $content = str_replace("\r\n", "\n", (string)($node['content'] ?? ''));
        $content = str_replace("\r", "\n", $content);

        $output .= "dt=Text\n<node>\n";
        $output .= $title . "\n";
        $output .= $depth . "\n";
        $output .= $content . "\n";
        $output .= self::END_NODE . "\n";

        foreach (($node['children'] ?? []) as $child) {
            if (is_array($child)) {
                $this->encodeNode($child, $depth + 1, $output);
            }
        }
    }

    private function newId(): string {
        return bin2hex(random_bytes(8));
    }
}
