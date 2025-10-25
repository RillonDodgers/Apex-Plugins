import { storage } from "@vendetta/plugin";

interface ImmichSettings {
  apiKey: string;
  serverUrl: string;
}

const DEFAULT_SETTINGS: ImmichSettings = {
  apiKey: "",
  serverUrl: ""
};

export const getSettings = (): ImmichSettings => {
  return { ...DEFAULT_SETTINGS, ...storage };
};

export const saveSettings = (settings: ImmichSettings): void => {
  Object.assign(storage, settings);
};

export const updateApiKey = (apiKey: string): void => {
  const settings = getSettings();
  settings.apiKey = apiKey;
  saveSettings(settings);
};

export const updateServerUrl = (serverUrl: string): void => {
  const settings = getSettings();
  settings.serverUrl = serverUrl;
  saveSettings(settings);
};

export const getApiKey = (): string => {
  const settings = getSettings();
  return settings.apiKey;
};

export const getServerUrl = (): string => {
  const settings = getSettings();
  return settings.serverUrl;
};

export const isConfigured = (): boolean => {
  const settings = getSettings();
  return settings.apiKey.trim() !== "" && settings.serverUrl.trim() !== "";
};
