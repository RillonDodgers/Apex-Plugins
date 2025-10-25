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
              
              // Log ActionSheet details for debugging - explore the full structure
              console.log("[ImmichSave] ActionSheet render - full props:", {
                sheetKey: props.sheetKey,
                hasOptions: !!props.options,
                optionsCount: props.options?.length || 0,
                allPropKeys: Object.keys(props),
                hasMessage: !!props.message,
                hasContent: !!props.content,
                hasData: !!props.data,
                title: props.title,
                header: props.header
              });
              
              // Extract message from the header props (based on the log structure we saw)
              const message = props.header?.props?.message;
              
              if (!message) {
                console.log("[ImmichSave] Skipping ActionSheet - no message found in header.props");
                return;
              }
              
              // Check if message has image attachments
              const hasImageAttachments = message.attachments?.some((att: any) => 
                att.content_type?.startsWith('image/') || 
                /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(att.filename)
              );
              
              if (!hasImageAttachments) {
                console.log("[ImmichSave] Skipping - no image attachments found");
                return;
              }
              
              console.log("[ImmichSave] Found message with image attachments - proceeding");
              
              // Debug the children structure since options is undefined
              console.log("[ImmichSave] Children debug:", {
                hasChildren: !!props.children,
                childrenType: typeof props.children,
                childrenIsArray: Array.isArray(props.children),
                childrenLength: props.children?.length,
                children: props.children
              });
              
              // For now, let's just debug the children structure without trying to modify it
              // This will help us understand what components are actually used
              if (props.children) {
                if (Array.isArray(props.children)) {
                  console.log("[ImmichSave] Children is array with length:", props.children.length);
                  props.children.forEach((child, index) => {
                    console.log(`[ImmichSave] Child ${index}:`, {
                      type: child?.type?.name || child?.type,
                      props: child?.props ? Object.keys(child.props) : 'no props',
                      hasOnPress: !!child?.props?.onPress,
                      label: child?.props?.label || child?.props?.children
                    });
                  });
                } else {
                  console.log("[ImmichSave] Children is not array:", {
                    type: props.children?.type?.name || props.children?.type,
                    props: props.children?.props ? Object.keys(props.children.props) : 'no props'
                  });
                }
              } else {
                console.log("[ImmichSave] No children found");
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
