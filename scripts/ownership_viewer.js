class OwnershipViewer {
	// Creates and applies the OwnershipViewer div to each document in a directory - called when each directory renders.
	static directoryRendered(obj, html, data) {
		if (!game.user.isGM || !obj._getEntryContextOptions) return;

		const contextOptions = obj._getEntryContextOptions();
		const ownershipOption = OwnershipViewer._getOwnershipContextOption(contextOptions);
		const root = OwnershipViewer._getHtmlRoot(html);
		if (!root) return;

		const renderContext = OwnershipViewer._getRenderContext(obj, data);
		if (!renderContext) return;

		const documentList = root.querySelectorAll(renderContext.query);

		const { INHERIT, NONE } = CONST.DOCUMENT_OWNERSHIP_LEVELS;

		for (const li of documentList) {
			const doc = renderContext.collection.get(li.dataset[renderContext.datasetKey]);
			if (!doc) continue;

			OwnershipViewer._removeExistingViewer(li, renderContext.isJournalPage);
			const users = [];
			const ownership = OwnershipViewer._getDocumentOwnership(doc);

			let defaultOwnership;
			for (const id in ownership) {
				const isDefault = id === "default";
				const user = game.users.get(id);
				const level = ownership[id] ?? NONE;

				if (
					(!isDefault && (!user || user.isGM || [defaultOwnership, INHERIT].includes(level)))
					|| level === NONE
				) continue;

				users.push(OwnershipViewer._createOwnershipMarker({
					defaultOwnership: isDefault,
					level,
					user,
					userId: id
				}));

				if (isDefault) defaultOwnership = level;
			}

			const div = OwnershipViewer._createOwnershipViewer(users, ownershipOption);
			if (!div) continue;

			if (ownershipOption) {
				div.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					OwnershipViewer._triggerOwnershipOption(ownershipOption, event, li);
				});
			}

			if (renderContext.isJournalPage) {
				const headings = li.querySelectorAll(".page-heading");
				if (headings.length === 0) {
					li.appendChild(div);
					continue;
				}

				for (const heading of headings) {
					const viewer = heading === headings[0] ? div : div.cloneNode(true);
					if (ownershipOption && viewer !== div) {
						viewer.addEventListener("click", (event) => {
							event.preventDefault();
							event.stopPropagation();
							OwnershipViewer._triggerOwnershipOption(ownershipOption, event, li);
						});
					}
					heading.appendChild(viewer);
				}
			} else {
				li.appendChild(div);
			}
		}
	}

	// Update the user color in OwnershipViewer divs if the user is edited
	static userUpdated(user) {
		for (const userDiv of document.querySelectorAll(".ownership-viewer-user")) {
			const { userId } = userDiv.dataset;
			if (userId == user.id) {
				userDiv.style.backgroundColor = OwnershipViewer._getUserColor(user);
			}
		}
	}

	// Makes the color assigned to each player clearer in the player list if they are inactive.
	static playerListRendered(list, html, options) {
		const root = OwnershipViewer._getHtmlRoot(html);
		const inactiveUsers = options?.inactive ?? [];
		if (!root || inactiveUsers.length === 0) return;

		const userIdColorMap = inactiveUsers
			.reduce((map, user) => {
				const currentUser = game.users.get(user.id);
				if (!currentUser) return map;
				map[user.id] = {
					border: OwnershipViewer._getColorValue(currentUser.border),
					color: OwnershipViewer._getColorValue(currentUser.color)
				};
				return map;
			}, {});

		const players = root.querySelectorAll("#players-inactive .player");
		for (const player of players) {
			const id = player.dataset.userId;
			const colors = userIdColorMap[id];
			if (!colors) continue;
			player.style.setProperty("--player-color", colors.color);
			player.style.setProperty("--player-border", colors.border);
		}
	}

	static _createOwnershipMarker({ defaultOwnership = false, level, user, userId }) {
		const ownershipLevelNames = OwnershipViewer._getOwnershipLevelNames();
		const levelName = ownershipLevelNames[level]?.toLowerCase();
		if (!levelName) return null;

		const userDiv = document.createElement("div");
		userDiv.dataset.userId = userId;
		userDiv.classList.add(`ownership-viewer-${levelName}`);
		userDiv.classList.add(defaultOwnership ? "ownership-viewer-all" : "ownership-viewer-user");

		if (!defaultOwnership && user) {
			userDiv.style.backgroundColor = OwnershipViewer._getUserColor(user);
		}

		const tooltipPrefix = user ? `${user.name}: ` : "";
		userDiv.setAttribute("data-tooltip", `${tooltipPrefix}${game.i18n.localize(`OWNERSHIP.${ownershipLevelNames[level]}`)}`);
		userDiv.setAttribute("data-tooltip-direction", "UP");

		return userDiv;
	}

	static _createOwnershipViewer(users, ownershipOption) {
		const markers = users.filter(Boolean);
		if (markers.length === 0 && !ownershipOption) return null;

		const div = document.createElement("div");
		div.className = "ownership-viewer";

		if (ownershipOption) {
			const anchor = document.createElement("div");
			div.appendChild(anchor);

			if (markers.length === 0) {
				anchor.appendChild(OwnershipViewer._createEmptyMarker());
				return div;
			}

			for (const marker of markers) {
				anchor.appendChild(marker);
			}
			return div;
		}

		for (const marker of markers) {
			div.appendChild(marker);
		}
		return div;
	}

	static _createEmptyMarker() {
		const iconWrapper = document.createElement("div");
		const icon = document.createElement("i");
		icon.className = "fas fa-share-alt";
		icon.style.color = "white";
		iconWrapper.appendChild(icon);
		return iconWrapper;
	}

	static _getRenderContext(obj, data) {
		const isLegacyJournalSheet = !!foundry.appv1?.sheets?.JournalSheet && obj instanceof foundry.appv1.sheets.JournalSheet;
		const isApplicationV2JournalSheet = !!foundry.applications?.sheets?.journal?.JournalEntrySheet
			&& obj instanceof foundry.applications.sheets.journal.JournalEntrySheet;

		if (isLegacyJournalSheet || isApplicationV2JournalSheet) {
			const document = data?.document ?? obj.document ?? obj.object;
			const collection = document?.collections?.pages ?? document?.pages;
			if (!collection) return null;

			return {
				collection,
				datasetKey: "pageId",
				isJournalPage: true,
				query: isLegacyJournalSheet ? "li.directory-item[data-page-id]" : "li[data-page-id]"
			};
		}

		const collection = obj.collection ?? obj.options?.collection;
		if (!collection) return null;

		return {
			collection,
			datasetKey: "entryId",
			isJournalPage: false,
			query: "li.directory-item.document"
		};
	}

	static _getDocumentOwnership(doc) {
		return doc.ownership ?? doc.permission ?? {};
	}

	static _getHtmlRoot(html) {
		if (html instanceof HTMLElement) return html;
		if (html?.[0] instanceof HTMLElement) return html[0];
		return null;
	}

	static _getColorValue(color) {
		return color?.css ?? color?.toString?.() ?? "";
	}

	static _getUserColor(user) {
		return OwnershipViewer._getColorValue(user?.color);
	}

	static _removeExistingViewer(li, isJournalPage) {
		for (const viewer of li.querySelectorAll(".ownership-viewer")) {
			viewer.remove();
		}

		if (isJournalPage) {
			li.querySelector(".page-ownership")?.remove();
		}
	}

	static _getOwnershipLevelNames() {
		if (!OwnershipViewer._ownershipLevelNames) {
			OwnershipViewer._ownershipLevelNames = foundry.utils.invertObject(CONST.DOCUMENT_OWNERSHIP_LEVELS);
		}

		return OwnershipViewer._ownershipLevelNames;
	}

	static _getOwnershipContextOption(contextOptions) {
		return contextOptions.find((option) => {
			const key = option?.name ?? option?.label;
			return key === "OWNERSHIP.Configure";
		});
	}

	static _triggerOwnershipOption(option, event, li) {
		if (typeof option?.onClick === "function") {
			option.onClick(event, li);
			return;
		}

		if (typeof option?.callback === "function") {
			option.callback(li);
		}
	}
}

Hooks.on("renderJournalSheet", OwnershipViewer.directoryRendered);
Hooks.on("renderJournalEntrySheet", OwnershipViewer.directoryRendered);
Hooks.on("renderJournalDirectory", OwnershipViewer.directoryRendered);
Hooks.on("renderActorDirectory", OwnershipViewer.directoryRendered);
Hooks.on("renderItemDirectory", OwnershipViewer.directoryRendered);
Hooks.on("renderMacroDirectory", OwnershipViewer.directoryRendered);
Hooks.on("renderRollTableDirectory", OwnershipViewer.directoryRendered);
Hooks.on("renderCardsDirectory", OwnershipViewer.directoryRendered);
Hooks.on("updateUser", OwnershipViewer.userUpdated);
Hooks.on("renderPlayers", OwnershipViewer.playerListRendered);
