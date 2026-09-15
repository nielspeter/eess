// Bug 0315 fixture: a class-based resolver. Its constructor and accessors are collected functions since
// 0315 and are never resolvers. Each calls the loader, so a rule that selected one would report it.
declare const loader: { load(key: string): unknown }
declare class Loader {}

export class AssetResolver {
  constructor(readonly assets: Loader) {
    loader.load('constructor')
  }

  get cacheKey(): string {
    return String(loader.load('get'))
  }

  set cacheKey(key: string) {
    loader.load(key)
  }

  asset(): unknown {
    return loader.load('asset')
  }

  related = (): unknown => loader.load('related')
}
