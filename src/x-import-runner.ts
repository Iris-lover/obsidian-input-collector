import type WeChatChannelsImporterPlugin from "./main";
import type { XImportOptions } from "./types";
import { importXPost, type XImportResult } from "./x-importer";

export async function runXImport(
  plugin: WeChatChannelsImporterPlugin,
  options: XImportOptions,
  onProgress: (message: string) => void,
): Promise<XImportResult> {
  const result = await importXPost(plugin.app, plugin.settings, options, onProgress);
  if (!result.reused) {
    plugin.settings.importedSources[result.parsed.sourceUrl] = {
      notePath: result.note.path,
      importedAt: new Date().toISOString(),
    };
    plugin.settings.lastCategory = options.category;
    plugin.settings.downloadXMedia = options.downloadMedia;
    await plugin.saveSettings();
  }
  await plugin.app.workspace.getLeaf(true).openFile(result.note);
  return result;
}
