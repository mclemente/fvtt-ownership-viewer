class OwnershipViewer {
	// Creates and applies the OwnershipViewer div to each document in a directory - called when each directory renders.
	static directoryRendered(obj, html, data) {
		if (!game.user.isGM || !obj._getEntryContextOptions) return;

		const contextOptions = obj._getEntryContextOptions();
		const ownershipOption = contextOptions.find((e) => (e.name ?? e.label) === "OWNERSHIP.Configure");

		const renderContext = OwnershipViewer._getRenderContext(obj, data);
		if (!renderContext) return;

		const documentList = html.querySelectorAll(renderContext.query);

		const { INHERIT, NONE } = CONST.DOCUMENT_OWNERSHIP_LEVELS;

		for (const li of documentList) {
			const doc = renderContext.collection.get(li.dataset[renderContext.datasetKey]);
			if (!doc) continue;

			if (li.querySelector(".ownership-viewer")) return;
			if (renderContext.isJournalPage) li.querySelector(".page-ownership")?.remove();
			const users = [];

			let defaultOwnership;
			for (const id in doc.ownership) {
				const isDefault = id === "default";
				const user = game.users.get(id);
				const ownership = doc.ownership[id] ?? 0;

				if (
					(!isDefault && (!user || user.isGM || [defaultOwnership, INHERIT].includes(ownership)))
					|| ownership === NONE
				) continue;

				users.push(OwnershipViewer._createOwnershipMarker(ownership, user, id, isDefault));

				if (isDefault) defaultOwnership = ownership;
			}

			const div = OwnershipViewer._createOwnershipViewer(users, ownershipOption);
			if (!div) continue;

			if (ownershipOption) {
				div.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					ownershipOption.callback?.(li); // V13
					ownershipOption.onClick?.(event, li); // V14
				});
			}

			if (renderContext.isJournalPage) {
				for (const heading of li.querySelectorAll(".page-heading")) {
					heading.appendChild(div);
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
				userDiv.style.backgroundColor = user.color;
			}
		}
	}

	// Makes the color assigned to each player clearer in the player list if they are inactive.
	static playerListRendered(list, html, options) {
		const userIdColorMap = options.inactive
			.reduce((map, user) => {
				const { border, color } = game.users.get(user.id);
				map[user.id] = { border, color };
				return map;
			}, {});

		const players = html.querySelectorAll("#players-inactive .player");
		for (const player of players) {
			const id = player.dataset.userId;
			player.style.setProperty("--player-color", userIdColorMap[id].color.css);
			player.style.setProperty("--player-border", userIdColorMap[id].border.css);
		}
	}

	static _createOwnershipMarker(ownership, user, userId, defaultOwnership = false) {
		OwnershipViewer._ownershipLevelNames ??= foundry.utils.invertObject(CONST.DOCUMENT_OWNERSHIP_LEVELS);
		const levelName = OwnershipViewer._ownershipLevelNames[ownership]?.toLowerCase();
		if (!levelName) return null;

		const userDiv = document.createElement("div");
		userDiv.dataset.userId = userId;
		userDiv.classList.add(`ownership-viewer-${levelName}`);
		userDiv.classList.add(defaultOwnership ? "ownership-viewer-all" : "ownership-viewer-user");

		if (!defaultOwnership && user) {
			userDiv.style.backgroundColor = user.color;
		}

		const tooltipPrefix = user ? `${user.name}: ` : "";
		userDiv.setAttribute("data-tooltip", `${tooltipPrefix}${game.i18n.localize(`OWNERSHIP.${OwnershipViewer._ownershipLevelNames[ownership]}`)}`);
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
			const doc = data?.document ?? obj.document ?? obj.object;
			const collection = doc?.collections?.pages ?? doc?.pages;
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
