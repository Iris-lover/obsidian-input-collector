import {
  App,
  ButtonComponent,
  Modal,
  Notice,
  Setting,
  TFolder,
  normalizePath,
} from "obsidian";
import type WeChatChannelsImporterPlugin from "./main";

function validateGroupName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error("分组名称不能为空");
  if (name === "." || name === ".." || /[\\/:*?\"<>|#^[\]]/.test(name)) {
    throw new Error("分组名称不能包含路径或文件名特殊字符");
  }
  return name;
}

export class GroupManagerModal extends Modal {
  constructor(
    app: App,
    private readonly plugin: WeChatChannelsImporterPlugin,
    private readonly onGroupsChanged: (selectedGroup: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("管理分组");
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("input-collector-group-manager");

    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "分组对应默认保存目录下的文件夹。删除分组不会删除已有文件。",
    });

    let newGroupName = "";
    new Setting(contentEl)
      .setName("新增分组")
      .addText((text) =>
        text.setPlaceholder("例如：Learning").onChange((value) => {
          newGroupName = value;
        }),
      )
      .addButton((button) =>
        button.setButtonText("新增").setCta().onClick(async () => {
          try {
            const name = validateGroupName(newGroupName);
            if (this.hasGroup(name)) throw new Error("这个分组已经存在");
            await this.ensureGroupFolder(name);
            this.plugin.settings.categories.push(name);
            this.plugin.settings.lastCategory = name;
            await this.plugin.saveSettings();
            this.onGroupsChanged(name);
            new Notice(`已新增分组：${name}`);
            this.render();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : String(error));
          }
        }),
      );

    contentEl.createEl("h4", { text: "现有分组" });
    for (const group of this.plugin.settings.categories) {
      let editedName = group;
      const row = new Setting(contentEl)
        .setClass("input-collector-group-row")
        .addText((text) =>
          text.setValue(group).onChange((value) => {
            editedName = value;
          }),
        );

      row.addButton((button) =>
        button.setButtonText("保存").onClick(async () => {
          try {
            const name = validateGroupName(editedName);
            if (name === group) return;
            if (this.hasGroup(name)) throw new Error("这个分组已经存在");
            await this.renameGroupFolder(group, name);
            this.updateImportedNotePaths(group, name);
            this.plugin.settings.categories = this.plugin.settings.categories.map(
              (item) => (item === group ? name : item),
            );
            if (this.plugin.settings.lastCategory === group) {
              this.plugin.settings.lastCategory = name;
            }
            await this.plugin.saveSettings();
            this.onGroupsChanged(name);
            new Notice(`已重命名为：${name}`);
            this.render();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : String(error));
          }
        }),
      );

      row.addButton((button) => {
        button.setIcon("trash-2").setTooltip("移除分组");
        this.markDestructive(button);
        button.onClick(async () => {
          if (this.plugin.settings.categories.length === 1) {
            new Notice("至少需要保留一个分组");
            return;
          }
          this.plugin.settings.categories = this.plugin.settings.categories.filter(
            (item) => item !== group,
          );
          const selected =
            this.plugin.settings.lastCategory === group
              ? this.plugin.settings.categories[0]
              : this.plugin.settings.lastCategory;
          this.plugin.settings.lastCategory = selected;
          await this.plugin.saveSettings();
          this.onGroupsChanged(selected);
          new Notice(`已移除分组：${group}（文件未删除）`);
          this.render();
        });
      });
    }
  }

  private hasGroup(name: string): boolean {
    const normalized = name.toLocaleLowerCase();
    return this.plugin.settings.categories.some(
      (group) => group.toLocaleLowerCase() === normalized,
    );
  }

  private groupPath(name: string): string {
    return normalizePath(`${this.plugin.settings.defaultFolder}/${name}`);
  }

  private async ensureGroupFolder(name: string): Promise<void> {
    const path = this.groupPath(name);
    let current = "";
    for (const part of path.split("/")) {
      current = normalizePath(current ? `${current}/${part}` : part);
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing && !(existing instanceof TFolder)) {
        throw new Error(`${current} 已存在且不是文件夹`);
      }
      if (!existing) await this.app.vault.createFolder(current);
    }
  }

  private async renameGroupFolder(oldName: string, newName: string): Promise<void> {
    const oldPath = this.groupPath(oldName);
    const newPath = this.groupPath(newName);
    const source = this.app.vault.getAbstractFileByPath(oldPath);
    const destination = this.app.vault.getAbstractFileByPath(newPath);
    if (source instanceof TFolder && destination) {
      throw new Error("目标文件夹已经存在，无法自动合并");
    }
    if (source instanceof TFolder) {
      await this.app.fileManager.renameFile(source, newPath);
    } else if (!destination) {
      await this.ensureGroupFolder(newName);
    }
  }

  private updateImportedNotePaths(oldName: string, newName: string): void {
    const oldPrefix = `${this.groupPath(oldName)}/`;
    const newPrefix = `${this.groupPath(newName)}/`;
    for (const record of Object.values(this.plugin.settings.importedSources)) {
      if (record.notePath.startsWith(oldPrefix)) {
        record.notePath = `${newPrefix}${record.notePath.slice(oldPrefix.length)}`;
      }
    }
  }

  private markDestructive(button: ButtonComponent): void {
    button.buttonEl.addClass("mod-warning");
  }
}
