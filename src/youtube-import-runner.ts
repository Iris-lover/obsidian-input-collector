import type WeChatChannelsImporterPlugin from "./main";
import type { YoutubeImportOptions } from "./types";
import { importYoutubeVideo, type YoutubeImportResult } from "./youtube-importer";

export async function runYoutubeImport(
  plugin: WeChatChannelsImporterPlugin,
  options: YoutubeImportOptions,
  onProgress: (message: string) => void,
): Promise<YoutubeImportResult> {
  const result = await importYoutubeVideo(
    plugin.app,
    plugin.settings,
    options,
    onProgress,
  );
  if (!result.reused) {
    plugin.settings.importedSources[result.parsed.sourceUrl] = {
      notePath: result.note.path,
      importedAt: new Date().toISOString(),
    };
    plugin.settings.importedSources[options.sourceUrl] = {
      notePath: result.note.path,
      importedAt: new Date().toISOString(),
    };
    plugin.settings.lastCategory = options.category;
    plugin.settings.downloadYoutubeVideo = options.downloadVideo;
    plugin.settings.downloadYoutubeCover = options.downloadCover;
    plugin.settings.downloadYoutubeSubtitles = options.downloadSubtitles;
    await plugin.saveSettings();
  }
  await plugin.app.workspace.getLeaf(true).openFile(result.note);
  return result;
}
