<?php

declare(strict_types=1);

namespace OCA\MeeTree\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\Util;

class PageController extends Controller {
    public function __construct(
        IRequest $request,
        private IURLGenerator $urlGenerator,
    ) {
        parent::__construct('meetree', $request);
    }

	/**
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): TemplateResponse {
        Util::addScript('meetree', 'markdown-it.min');
        Util::addScript('meetree', 'tree-markdown');
        Util::addScript('meetree', 'meetree');
        Util::addStyle('meetree', 'meetree');

        return new TemplateResponse('meetree', 'index', [
            'endpoint' => $this->urlGenerator->linkToRoute('meetree.document.get'),
        ]);
    }
}
