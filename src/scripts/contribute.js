const root = document.querySelector('#rs-marketplace-sketch');
const packs = JSON.parse(document.querySelector('#contribution-packs').textContent);
const byId = new Map(packs.map(pack => [pack.id,pack]));
const origin = new URLSearchParams(location.search).get('basedOn');
const state = { origin: byId.has(origin) ? origin : null };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, handler, primary) {
    const node = element(
      "button",
      "mp-button cursor-interaction" + (primary ? " mp-button-primary" : ""),
      text,
    );
    node.type = "button";
    node.addEventListener("click", handler);
    return node;
  }

  const dialog = root.querySelector("#mp-preview-dialog");
  const dialogContent = root.querySelector("#mp-dialog-content");
  const dialogActions = root.querySelector("#mp-dialog-actions");
  let opener = null;
  function closeDialog() {
    if (dialog.open) dialog.close();
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  }
  function openDialog(title) {
    opener = document.activeElement;
    root.querySelector("#mp-dialog-title").textContent = title;
    dialogContent.replaceChildren();
    dialogActions.replaceChildren();
    const rootTop = root.getBoundingClientRect().top;
    const offset = Math.max(24, -rootTop + 60);
    dialog.style.top = offset + "px";
    dialog.showModal();
  }

  const contributionForm = root.querySelector("#mp-contribution-form");
  function previewContribution() {
    const form = contributionForm;
    if (!form.reportValidity()) return;
    const basePack = state.origin ? byId.get(state.origin) : null;
    const repo = "registry-stack";
    const body = [
      "## Proposed marketplace contribution",
      "Pack: " + form.elements.packName.value,
      "Type: " + form.elements.packType.value,
      "Licence: " + form.elements.licence.value,
      "Repository: " + form.elements.repository.value,
      basePack
        ? "Based on: " + basePack.title + " (" + basePack.source + ")"
        : "Independent contribution",
      "",
      "## Task and scope",
      form.elements.summary.value,
      "",
      "I confirm that I have the rights to share this pack under the stated licence.",
    ].join("\n");
    openDialog("Review your contribution on GitHub");
    dialogContent.append(
      element(
        "p",
        "",
        "Continue to a prefilled issue draft. Review it and submit it on GitHub. No contribution has been sent by this site.",
      ),
    );
    if (basePack)
      dialogContent.append(element("p", "", "Based on: " + basePack.title));
    const link = element(
      "a",
      "mp-button mp-button-primary",
      "Open GitHub draft",
    );
    link.href =
      "https://github.com/registrystack/" +
      repo +
      "/issues/new?" +
      new URLSearchParams({
        title: "Marketplace contribution: " + form.elements.packName.value,
        body,
      });
    link.dataset.marketplaceAction = "contribution_draft_open";
    if (state.origin) link.dataset.marketplacePack = state.origin;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    dialogActions.append(link, button("Keep editing", closeDialog));
  }
  root
    .querySelector("#mp-preview-contribution")
    .addEventListener("click", previewContribution);
  contributionForm.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      event.target.tagName !== "TEXTAREA" &&
      event.target.tagName !== "BUTTON"
    ) {
      event.preventDefault();
      previewContribution();
    }
  });

root.querySelector('[data-close]').addEventListener('click',closeDialog);
const showOrigin = () => { root.querySelector('#mp-contribution-origin').hidden = !state.origin; root.querySelector('#mp-contribution-origin-label').textContent = state.origin ? 'Based on: ' + byId.get(state.origin).title : ''; };
root.querySelector('[data-clear-origin]').addEventListener('click',()=>{state.origin=null;showOrigin();});
root.querySelector('#mp-contribution-form').addEventListener('submit',event=>{event.preventDefault();previewContribution();});
showOrigin();
