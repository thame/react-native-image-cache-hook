import ReactNativeBlobUtil, {StatefulPromise, FetchBlobResponse} from 'react-native-blob-util';
import sha1 from 'sha1';

const BASE_PATH = ReactNativeBlobUtil.fs.dirs.DocumentDir;

interface ItemQueue {
  hash: string;
  isDownloading: boolean;
  downloadHandle: StatefulPromise<FetchBlobResponse> | Promise<boolean>;
}

export default class CacheManager {
  static filesCached: {[hash: string]: string} = {};
  static downloadQueue: ItemQueue[] = [];

  cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = BASE_PATH + cacheDir;
  }

  async getPathByUri(uri: string): Promise<string> {
    const hash = sha1(uri);
    try {
      if (!CacheManager.filesCached[hash]) {
        await this.getCacheOrDownload(uri, hash);
      }

      return CacheManager.filesCached[hash];
    } catch (e) {
      return '';
    }
  }

  clearCache(): Promise<void> {
    return ReactNativeBlobUtil.fs.unlink(this.cacheDir);
  }

  private async getCacheOrDownload(uri: string, hash: string): Promise<void> {
    const imagePath = this.cacheDir + hash;

    if (await this.existsFileCache(imagePath)) {
      CacheManager.filesCached[hash] = imagePath;
      return;
    }

    const itemQueue = this.getQueueByHash(hash);
    if (itemQueue && itemQueue.isDownloading) {
      await itemQueue.downloadHandle;
      return;
    }

    const downloadHandle = ReactNativeBlobUtil.config({
      fileCache: true,
      path: imagePath,
    }).fetch('GET', uri);

    CacheManager.downloadQueue.push({
      hash,
      downloadHandle,
      isDownloading: true,
    });

    await downloadHandle;
    CacheManager.filesCached[hash] = imagePath;
    this.removeItemQueue(hash);
  }

  private getQueueByHash(hash: string): ItemQueue | undefined {
    return CacheManager.downloadQueue.find((item) => item.hash === hash);
  }

  private removeItemQueue(hash: string): void {
    CacheManager.downloadQueue = CacheManager.downloadQueue.filter(
      (item) => item.hash !== hash,
    );
  }

  private async existsFileCache(imagePath: string): Promise<boolean> {
    return await ReactNativeBlobUtil.fs.exists(imagePath);
  }
}
