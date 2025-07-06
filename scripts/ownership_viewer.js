class OwnershipViewer {
	// Creates and applies the OwnershipViewer div to each document in a directory - called when each directory renders.
	static directoryRendered(obj, html, data) {
		if (!game.user.isGM || !obj._getEntryContextOptions) return;

		// Get the current directory's right-click context options, then tore the ownership config option
		const contextOptions = obj._getEntryContextOptions();
		const ownershipOption = contextOptions.find((e) => e.name === "OWNERSHIP.Configure");

		// Determine if we are working with a directory or a journal sheet
		const isJournalSheet = obj instanceof foundry.appv1.sheets.JournalSheet;
		const isJournalEntrySheet = obj instanceof foundry.applications.sheets.journal.JournalEntrySheet;

		// Gather all documents in the current directory or journal
		let collection = obj.options.collection;
		let query = "li.directory-item.document";
		if (isJournalSheet) {
			collection = obj.object.collections.pages
			query = "li.directory-item.level1";
		} else if (isJournalEntrySheet) {
			collection = data.document.collections.pages
			query = "li.level1";
		}
		const documentList = isJournalSheet ? html.find(query) : html.querySelectorAll(query);

		const { INHERIT, NONE } = CONST.DOCUMENT_OWNERSHIP_LEVELS;

		// Interate through each directory list item.
		for (let li of documentList) {
			// Match it to the corresponding document
			const doc = collection.get(li.dataset[`${isJournalSheet || isJournalEntrySheet ? "page" : "entry"}Id`]);
			const users = [];

			// Iterate through each ownership definition on the document
			let defaultOwnership;
			for (let id in doc.ownership) {
				const isDefault = id === "default";
				const user = game.users.get(id);
				const ownership = doc.ownership[id] ?? 0;

				// Skip if user is GM, has default ownership, no ownership (0) or inherits (-1)
				if (
					(!isDefault && (!user || user.isGM || [defaultOwnership, INHERIT].includes(ownership)))
					|| ownership === NONE
				) continue;
				// If the ownership definition isn't 'None'...
				// Create the div for this ownership definition, with the appropriate class based on the ownership level
				const userDiv = document.createElement('div');
				userDiv.setAttribute('data-user-id', id);

				// And if the ownership definition isn't 'All Players' (default) or a GM, set 'bg_color' to the user's color
				if (!isDefault) {
					userDiv.style.backgroundColor = user.color;
					userDiv.setAttribute("data-tooltip", user.name);
				}

				const ownerships = foundry.utils.invertObject(CONST.DOCUMENT_OWNERSHIP_LEVELS);
				userDiv.classList.add(`ownership-viewer-${ownerships[ownership].toLowerCase()}`);

				const tooltip = `${user ? user.name + ": " : ""}${game.i18n.localize("OWNERSHIP." + ownerships[ownership])}`;
				userDiv.setAttribute("data-tooltip", tooltip);
				userDiv.setAttribute("data-tooltip-direction", "UP");

				if (isDefault) {
					userDiv.classList.add("ownership-viewer-all");
					defaultOwnership = ownership;
				} else {
					userDiv.classList.add("ownership-viewer-user");
				}

				// Store the resulting div and keep iterating through the other ownership definitions on the document
				users.push(userDiv);
			}

			const div = document.createElement('div');
			div.className = 'ownership-viewer';

			// Append the collection of divs to the document's list item, or add the 'none set' icon if empty
			if (ownershipOption) {
				if (users.length === 0) {
					const iconWrapper = document.createElement('div');
					const icon = document.createElement('i');
					icon.className = 'fas fa-share-alt';
					icon.style.color = 'white';
					iconWrapper.appendChild(icon);
					users.push(iconWrapper);
				}
				const anchor = document.createElement('div');
				div.appendChild(anchor);
				users.forEach(user => anchor.appendChild(user));
			} else {
				users.forEach(user => div.appendChild(user));
			}

			if (isJournalSheet || isJournalEntrySheet) {
				li.querySelector(".page-ownership")?.remove();
				for (const heading of li.querySelectorAll(".page-heading")) {
					// heading.appendChild(div);
					heading.appendChild(div.cloneNode(true));
				}
			} else {
				li.appendChild(div);
			}
		}

		// Ensure any clicks on the OwnershipViewer div open the ownership config for that document
		if (ownershipOption) {
			function clickEvent(event) {
				event.preventDefault();
				event.stopPropagation();
				const li = event.currentTarget.closest("li");
				if (li) ownershipOption.callback(li);
			}

			if (isJournalSheet || isJournalEntrySheet) {
				// On journal sheets, delay registering click events until the page is selected and its header is expanded
				Hooks.once("renderJournalEntryPageSheet", () => {
					html.find(".ownership-viewer").on("click", clickEvent);
				});
			} else {
				html.querySelectorAll(".ownership-viewer")?.forEach((el) => {
					el.addEventListener("click", clickEvent);
				})
			}
		}
	}

	// Update the user color in OwnershipViewer divs if the user is edited
	static userUpdated(user) {
		for (let userDiv of document.querySelectorAll(".ownership-viewer-user")) {
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
		for (let player of players) {
			const id = player.dataset.userId;
			player.style.setProperty("--player-color", userIdColorMap[id].color.css);
			player.style.setProperty("--player-border", userIdColorMap[id].border.css);
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
