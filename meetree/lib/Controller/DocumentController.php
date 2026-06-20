<?php

declare(strict_types=1);

namespace OCA\MeeTree\Controller;

use OCA\MeeTree\Service\DocumentService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataDownloadResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

class DocumentController extends Controller {
    public function __construct(
        IRequest $request,
        private DocumentService $documentService,
    ) {
        parent::__construct('meetree', $request);
    }

	/**
	 * @NoAdminRequired
	 */
	#[NoAdminRequired]
	public function get(): JSONResponse {
        return new JSONResponse($this->documentService->getDocument());
    }

	/**
	 * @NoAdminRequired
	 */
	#[NoAdminRequired]
	public function save(array $document): JSONResponse {
        $this->documentService->saveDocument($document);
        return new JSONResponse(['status' => 'saved']);
    }

	/**
	 * @NoAdminRequired
	 */
	#[NoAdminRequired]
	public function importDocument(string $content, string $filename = 'import.hjt'): JSONResponse {
        $document = $this->documentService->importDocument($filename, $content);
        return new JSONResponse($document);
    }

	/**
	 * @NoAdminRequired
	 */
	#[NoAdminRequired]
	public function importHjt(string $content): JSONResponse {
        $document = $this->documentService->importHjt($content);
        return new JSONResponse($document);
    }

	/**
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function exportHjt(): DataDownloadResponse {
        return new DataDownloadResponse(
            $this->documentService->exportHjt(),
            'meetree.hjt',
            'text/plain; charset=utf-8'
        );
    }

	/**
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function exportCtd(): DataDownloadResponse {
        return new DataDownloadResponse(
            $this->documentService->exportCtd(),
            'meetree.ctd',
            'application/xml; charset=utf-8'
        );
    }

	/**
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function exportJson(): DataDownloadResponse {
        return new DataDownloadResponse(
            $this->documentService->exportJson(),
            'meetree.meetree.json',
            'application/json; charset=utf-8'
        );
    }

	/**
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function search(
        string $query = '',
        bool $titles = true,
        bool $content = true,
        bool $caseSensitive = false,
        bool $regex = false,
    ): JSONResponse {
        return new JSONResponse($this->documentService->search($query, $titles, $content, $caseSensitive, $regex));
    }
}
