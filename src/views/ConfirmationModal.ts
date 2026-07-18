import { App, Modal, Setting } from "obsidian";

export class ConfirmationModal extends Modal {
	private toolName: string;
	private description: string;
	private args: Record<string, unknown>;
	private onConfirm: (confirmed: boolean) => void;
	private resolved = false;

	constructor(app: App, toolName: string, description: string, args: Record<string, unknown>, onConfirm: (confirmed: boolean) => void) {
		super(app);
		this.toolName = toolName;
		this.description = description;
		this.args = args;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("ai-copilot-confirmation-modal");

		contentEl.createEl("h2", { text: `Acción Requerida: ${this.toolName}` });
		
		const descEl = contentEl.createEl("p", { text: this.description });
		descEl.style.marginBottom = "10px";

		contentEl.createEl("h4", { text: "Argumentos de la Herramienta", cls: "ai-copilot-confirmation-args-title" });
		const codeBlock = contentEl.createEl("pre", { cls: "ai-copilot-confirmation-args" });
		codeBlock.createEl("code", { text: JSON.stringify(this.args, null, 2) });

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("✅ Permitir")
					.setCta()
					.onClick(() => {
						this.resolved = true;
						this.onConfirm(true);
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("❌ Rechazar")
					.setWarning()
					.onClick(() => {
						this.resolved = true;
						this.onConfirm(false);
						this.close();
					})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		
		// If closed by pressing escape or clicking outside
		if (!this.resolved) {
			this.onConfirm(false);
		}
	}
}
