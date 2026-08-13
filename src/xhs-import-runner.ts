import type WeChatChannelsImporterPlugin from "./main";
import type { XhsImportOptions } from "./types";
import { importXhsNote, type XhsImportResult } from "./xhs-importer";

export async function runXhsImport(
  plugin: WeChatChannelsImporterPlugin,
  options: XhsImportOptions,
  onProgress: (message: string) => void,
): Promise<XhsImportResult> {
  const result = await importXhsNote(plugin.app, plugin.settings, options, onProgress);
  if (!result.reused) {
    plugin.settings.importedSources[result.parsed.sourceUrl] = {
      notePath: result.note.path,
      importedAt: new Date().toISOString(),
    };
    plugin.settings.lastCategory = options.category;
    plugin.settings.downloadXhsMedia = options.downloadMedia;
    await plugin.saveSettings();
  }
  await plugin.app.workspace.getLeaf(true).openFile(result.note);
  return result;
}
