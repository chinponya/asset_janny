import { compareVersion, parseVersion, Version } from "./version.ts";
import { GameServer } from "./endpoint.ts";

export enum Language {
  EN = "en",
  CHS = "chs",
  CHS_T = "chs_t",
  JP = "jp",
  KR = "kr",
}

const languageOrder = Object.values(Language);

export type Resource = {
  server: GameServer;
  language: Language;
  path: string;
  version: Version;
};

export type Resources = Array<Resource>;

const MISSING_RESOURCE_PATTERN = new RegExp(
  "^chs_t/myres/lobby/lobby - 快捷方式\.lnk",
);
const LOW_QUALITY_RESOURCE_PATTERN = new RegExp("_q7/");
// we test for negative pattern for known missing assets per server to reduce the likelihood of skipping future unaccounted for files
const EN_SERVER_NEGATIVE_PATTERN = new RegExp(
  "^(lang/|jp/|extendRes/|res/atlas/jp/|res/atlas/myres/|myres2/|res/atlas_q7/jp/|myres/|res/atlas/myres2/|course/|bitmapfont/jp|bitmapfont/chs_t|yostar_sdk/jp/|newyear_loading/)",
);
const JP_SERVER_NEGATIVE_PATTERN = new RegExp(
  "^(lang/|en/|kr/|chs_t/|extendRes/|res/atlas/en/|res/atlas/kr|res/atlas/chs_t/|res/atlas_q7/chs_t/|res/atlas/myres/|myres2/|res/atlas_q7/en/|res/atlas_q7/kr/|yostar_sdk/en/|yostar_sdk/kr/|myres/|res/atlas/myres2/|course/|bitmapfont/en/|bitmapfont/kr/|bitmapfont/chs_t|newyear_loading/|scene/Assets/Resource/mjpaimian/en_kr/|scene/Assets/Resource/mjpaimian/en|scene/Assets/Resource/mjpai/en|scene/Assets/Resource/mjpai/en_kr/)",
);
const CN_SERVER_NEGATIVE_PATTERN = new RegExp(
  "^(en/|kr/|jp/|chs_t/|scene/|res/atlas/en/|res/atlas/kr/|res/atlas/jp/|res/atlas_q7/en/|res/atlas_q7/kr/|res/atlas_q7/jp/|yostar_sdk/|bitmapfont/en/|bitmapfont/kr/|bitmapfont/jp|scene/Assets/Resource/mjpaimian/en_kr/|scene/Assets/Resource/mjpaimian/en/|scene/Assets/Resource/mjpai/en/|scene/Assets/Resource/mjpai/en_kr/)",
);

export function fromResversion(
  path: string,
  versionStr: string,
  includeLowQuality: boolean,
  includeOldCNResources: boolean,
): Resource {
  const version = parseVersion(versionStr);
  const server = serverOfResourcePath(
    path,
    version,
    includeLowQuality,
    includeOldCNResources,
  );
  const language = languageOfResourcePath(path, server);
  return { server, language, path, version };
}

export function serverOfResourcePath(
  path: string,
  version: Version,
  includeLowQuality: boolean,
  includeOldCNResources: boolean,
): GameServer {
  if (
    MISSING_RESOURCE_PATTERN.test(path) ||
    (!includeLowQuality && LOW_QUALITY_RESOURCE_PATTERN.test(path)) ||
    (!includeOldCNResources && isOldCNPath(path, version))
  ) {
    return GameServer.NONE;
  } else if (existsOnENServer(path)) {
    return GameServer.EN;
  } else if (existsOnJPServer(path)) {
    return GameServer.JP;
  } else if (existsOnCNServer(path, version)) {
    return GameServer.CN;
  } else {
    return GameServer.NONE;
  }
}

export function isOldCNPath(path: string, version: Version): boolean {
  const maxOldSceneVersion: Version = { major: 0, minor: 10, patch: 297 };
  const maxOldChsTVersion: Version = { major: 0, minor: 11, patch: 12 };
  const matchesOldScene = compareVersion(maxOldSceneVersion, version) <= 0 &&
    /^scene\//.test(path);
  const matchesOldChsT = compareVersion(maxOldChsTVersion, version) <= 0 &&
    /^chs_t\//.test(path) && !(/\/en\/|\/kr\/|\/jp\/|\/en_kr\//).test(path);
  return matchesOldScene || matchesOldChsT;
}

export function existsOnENServer(path: string): boolean {
  return !(EN_SERVER_NEGATIVE_PATTERN.test(path));
}

export function existsOnJPServer(path: string): boolean {
  return !(JP_SERVER_NEGATIVE_PATTERN.test(path));
}

export function existsOnCNServer(path: string, version: Version): boolean {
  return !CN_SERVER_NEGATIVE_PATTERN.test(path) || isOldCNPath(path, version);
}

export function languageOfResourcePath(
  path: string,
  gameServer: GameServer,
): Language {
  if (/^en\/|\/en\//.test(path)) {
    return Language.EN;
  } else if (/^en_kr\/|\/en_kr\//.test(path)) {
    return Language.KR;
  } else if (/^kr\/|\/kr\//.test(path)) {
    return Language.KR;
  } else if (/^jp\/|\/jp\//.test(path)) {
    return Language.JP;
  } else if (/^chs_t\/|\/chs_t\//.test(path)) {
    return Language.CHS_T;
  } else if (gameServer == GameServer.CN) {
    return Language.CHS;
  } else if (gameServer == GameServer.EN) {
    return Language.EN;
  } else if (gameServer == GameServer.JP) {
    return Language.JP;
  } else {
    return Language.CHS;
  }
}

export function resourcePrefixForLanguage(language: Language): string {
  if (language == Language.CHS) {
    return "";
  } else {
    return `${language}/`;
  }
}

export function toBasePath(resource: Resource): string {
  const language = languageOfResourcePath(resource.path, resource.server);
  const prefix = resourcePrefixForLanguage(language);
  return resource.path.replace(prefix, "");
}

function findResource(resources: Resources, expected_path: string): Resource {
  const found = resources.find((e) => e.path == expected_path);
  if (found) {
    return found;
  } else {
    throw (`${expected_path} not found in resource list`);
  }
}

export function resourcesNewerThan(
  resources: Resources,
  version: Version,
): Resources {
  return resources.filter((r) => compareVersion(r.version, version) > 0);
}

export function findConfigProtoResource(resources: Resources): Resource {
  const configProtoResourcePath = "res/proto/config.proto";
  return findResource(resources, configProtoResourcePath);
}

export function findMetadataResource(resources: Resources): Resource {
  const mappingsResourcePath = "res/config/lqc.lqbin";
  return findResource(resources, mappingsResourcePath);
}

export function compareByLanguage(a: Resource, b: Resource) {
  return languageOrder.indexOf(a.language) - languageOrder.indexOf(b.language);
}
