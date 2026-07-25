import type WeChatChannelsImporterPlugin from "./main";
import { importVideo, type ImportResult } from "./importer";
import type { ImportOptions } from "./types";

export async function runImport(
  plugin: WeChatChannelsImporterPlugin,
  options: ImportOptions,
  onProgress: (message: string) => void,
): Promise<ImportResult> {
  const result = await importVideo(
    plugin.app,
    plugin.settings,
    options,
    onProgress,
  );

  if (!result.reused) {
    plugin.settings.importedSources[options.sourceUrl] = {
      notePath: result.note.path,
      importedAt: new Date().toISOString(),
    };
    plugin.settings.lastCategory = options.category;
    plugin.settings.downloadVideo = options.downloadVideo;
    plugin.settings.downloadCover = options.downloadCover;
    await plugin.saveSettings();
  }

  await plugin.app.workspace.getLeaf(true).openFile(result.note);
  return result;
}
