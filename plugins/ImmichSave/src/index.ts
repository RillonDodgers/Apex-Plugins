import { showToast } from "@vendetta/ui/toasts";
import { before } from '@vendetta/patcher';
import { getAssetIDByName } from '@vendetta/ui/assets';
import { findByProps } from "@vendetta/metro";
import { 
  getApiKey,
  getServerUrl,
  updateApiKey,
  updateServerUrl,
  isConfigured
} from "./Settings";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const ActionSheet = findByProps("ActionSheet")?.ActionSheet;
let unpatchActionSheet: any;

// TODO: Re-implement Immich upload functionality after identifying correct ActionSheet keys


const SettingsComponent = () => {
  const [apiKey, setApiKey] = React.useState(getApiKey());
  const [serverUrl, setServerUrl] = React.useState(getServerUrl());

  const handleSaveApiKey = () => {
    updateApiKey(apiKey);
    showToast("API Key saved!", getAssetIDByName("ic_check"));
  };

  const handleSaveServerUrl = () => {
    updateServerUrl(serverUrl);
    showToast("Server URL saved!", getAssetIDByName("ic_check"));
  };

  return React.createElement(React.Fragment, null,
    React.createElement(Forms.FormSection, { title: "Immich Configuration" },
      React.createElement(Forms.FormText, { style: { marginBottom: 10 } }, 
        "Configure your Immich server connection:"
      ),
      React.createElement(Forms.FormInput, {
        placeholder: "Enter your Immich API Key",
        value: apiKey,
        onChange: setApiKey,
        secureTextEntry: true
      }),
      React.createElement(Forms.FormRow, {
        label: "Save API Key",
        onPress: handleSaveApiKey
      }),
      React.createElement(Forms.FormInput, {
        placeholder: "Enter Immich Server URL (e.g., https://immich.example.com)",
        value: serverUrl,
        onChange: setServerUrl
      }),
      React.createElement(Forms.FormRow, {
        label: "Save Server URL",
        onPress: handleSaveServerUrl
      })
    ),
    
    React.createElement(Forms.FormSection, { title: "Status" },
      React.createElement(Forms.FormText, { style: { marginBottom: 10 } }, 
        isConfigured() ? "✅ Immich is configured and ready to use!" : "❌ Please configure Immich settings above"
      )
    )
  );
};

export default {
   onLoad: () => {
        console.log("[ImmichSave] Plugin loaded!");
        
        if (ActionSheet) {
          console.log("[ImmichSave] Found ActionSheet component, patching render method");
          unpatchActionSheet = before("render", ActionSheet, (args) => {
            try {
              const [props] = args;
              
              // Log ActionSheet details for debugging
              console.log("[ImmichSave] ActionSheet render:", {
                sheetKey: props.sheetKey,
                hasOptions: !!props.options,
                optionsCount: props.options?.length || 0
              });
              
              // Only target MessageLongPressActionSheet
              if (props.sheetKey !== "MessageLongPressActionSheet") {
                console.log("[ImmichSave] Skipping ActionSheet:", props.sheetKey);
                return;
              }
              
              console.log("[ImmichSave] Processing message ActionSheet:", props.sheetKey);
              
              // Add our menu option
              if (props.options && !props.options.some((option: any) => option?.label === "Save to Immich")) {
                console.log("[ImmichSave] Adding Save to Immich option");
                
                props.options.unshift({
                  label: "Save to Immich",
                  icon: getAssetIDByName("ic_download"),
                  onPress: () => {
                    try {
                      console.log("[ImmichSave] Save to Immich pressed!");
                      showToast("Save to Immich clicked! (functionality coming soon)", getAssetIDByName("ic_check"));
                      props.hideActionSheet?.();
                    } catch (e) {
                      console.error("[ImmichSave] Error in Save to Immich handler:", e);
                      showToast("Error occurred", getAssetIDByName("ic_close_16px"));
                    }
                  },
                });
                
                console.log("[ImmichSave] Successfully added Save to Immich option");
              }
            } catch (e) {
              console.error("[ImmichSave] ActionSheet patch error:", e);
            }
          });
        } else {
          console.warn("[ImmichSave] Could not find ActionSheet component");
        }
   },
   onUnload: () => {
     if (unpatchActionSheet) {
       unpatchActionSheet();
     }
   },
   
   settings: SettingsComponent
};
