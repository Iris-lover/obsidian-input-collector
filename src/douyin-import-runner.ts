import type WeChatChannelsImporterPlugin from "./main";
import type { DouyinImportOptions } from "./types";
import { importDouyinVideo, type DouyinImportResult } from "./douyin-importer";

export async function runDouyinImport(
  plugin: WeChatChannelsImporterPlugin,
  options: DouyinImportOptions,
  onProgress: (message: string) => void,
): Promise<DouyinImportResult> {
  const result = await importDouyinVideo(plugin.app, plugin.settings, options, onProgress);
  if (!result.reused) {
    plugin.settings.importedSources[result.parsed.sourceUrl] = {
      notePath: result.note.path,
      importedAt: new Date().toISOString(),
    };
    plugin.settings.lastCategory = options.category;
    plugin.settings.downloadDouyinMedia = options.downloadMedia;
    plugin.settings.downloadDouyinCover = options.downloadCover;
    await plugin.saveSettings();
  }
  await plugin.app.workspace.getLeaf(true).openFile(result.note);
  return result;
}
