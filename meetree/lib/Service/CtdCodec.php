<?php

declare(strict_types=1);

namespace OCA\MeeTree\Service;

use InvalidArgumentException;
use SimpleXMLElement;

class CtdCodec {
    public function decode(string $ctd): array {
        $previous = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($ctd);
        libxml_use_internal_errors($previous);

        if (!$xml instanceof SimpleXMLElement || $xml->getName() !== 'cherrytree') {
            throw new InvalidArgumentException('This is not a supported CherryTree CTD document.');
        }

        $children = [];
        foreach ($xml->node as $nodeXml) {
            $children[] = $this->decodeNode($nodeXml);
        }

        if (count($children) === 1) {
            return ['root' => $children[0]];
        }

        return [
            'root' => [
                'id' => $this->newId(),
                'title' => 'CherryTree document',
                'content' => '',
                'children' => $children,
            ],
        ];
    }

    public function encode(array $document): string {
        $root = $document['root'] ?? [];
        $output = "<?xml version=\"1.0\" ?>\n<cherrytree>\n";
        $this->encodeNode($root, $output, 1);
        $output .= "</cherrytree>\n";
        return $output;
    }

    private function decodeNode(SimpleXMLElement $nodeXml): array {
        $contentParts = [];
        foreach ($nodeXml->rich_text as $richText) {
            $contentParts[] = (string)$richText;
        }
        foreach ($nodeXml->codebox as $codebox) {
            $contentParts[] = (string)$codebox;
        }

        $children = [];
        foreach ($nodeXml->node as $childXml) {
            $children[] = $this->decodeNode($childXml);
        }

        $id = (string)($nodeXml['unique_id'] ?? '');
        if ($id === '') {
            $id = $this->newId();
        }

        return [
            'id' => $id,
            'title' => (string)($nodeXml['name'] ?? 'Untitled'),
            'content' => implode("\n", array_filter($contentParts, static fn (string $part): bool => $part !== '')),
            'children' => $children,
            'compat' => [
                'cherrytree' => [
                    'unique_id' => $id,
                    'prog_lang' => (string)($nodeXml['prog_lang'] ?? 'custom-colors'),
                    'tags' => (string)($nodeXml['tags'] ?? ''),
                    'readonly' => (string)($nodeXml['readonly'] ?? '0'),
                    'custom_icon_id' => (string)($nodeXml['custom_icon_id'] ?? '0'),
                    'is_bold' => (string)($nodeXml['is_bold'] ?? '0'),
                    'foreground' => (string)($nodeXml['foreground'] ?? ''),
                ],
            ],
        ];
    }

    private function encodeNode(array $node, string &$output, int $indent): void {
        $prefix = str_repeat('  ', $indent);
        $compat = $node['compat']['cherrytree'] ?? [];
        $id = preg_replace('/\D+/', '', (string)($compat['unique_id'] ?? $node['id'] ?? ''));
        if ($id === '') {
            $id = (string)random_int(1, PHP_INT_MAX);
        }
        $now = (string)time();

        $attrs = [
            'unique_id' => $id,
            'master_id' => '0',
            'name' => (string)($node['title'] ?? 'Untitled'),
            'prog_lang' => (string)($compat['prog_lang'] ?? 'custom-colors'),
            'tags' => (string)($compat['tags'] ?? ''),
            'readonly' => (string)($compat['readonly'] ?? '0'),
            'nosearch_me' => '0',
            'nosearch_ch' => '0',
            'custom_icon_id' => (string)($compat['custom_icon_id'] ?? '0'),
            'is_bold' => (string)($compat['is_bold'] ?? '0'),
            'foreground' => (string)($compat['foreground'] ?? ''),
            'ts_creation' => (string)($compat['ts_creation'] ?? $now),
            'ts_lastsave' => $now,
        ];

        $output .= $prefix . '<node';
        foreach ($attrs as $key => $value) {
            $output .= ' ' . $key . '="' . htmlspecialchars($value, ENT_XML1 | ENT_COMPAT, 'UTF-8') . '"';
        }
        $output .= ">\n";

        $content = (string)($node['content'] ?? '');
        if ($content !== '') {
            $output .= $prefix . '  <rich_text>' . htmlspecialchars($content, ENT_XML1 | ENT_NOQUOTES, 'UTF-8') . "</rich_text>\n";
        }

        foreach (($node['children'] ?? []) as $child) {
            if (is_array($child)) {
                $this->encodeNode($child, $output, $indent + 1);
            }
        }
        $output .= $prefix . "</node>\n";
    }

    private function newId(): string {
        return bin2hex(random_bytes(8));
    }
}
