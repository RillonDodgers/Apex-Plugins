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
const ActionSheetRow = findByProps("ActionSheetRow")?.ActionSheetRow;
let unpatchActionSheet: any;

const testImmichConnection = (): void => {
  const apiKey = getApiKey();
  const serverUrl = getServerUrl();
  
  if (!apiKey || !serverUrl) {
    showToast("Immich not configured!", getAssetIDByName("ic_close_16px"));
    return;
  }

  // First test: Try fetch like MoreAlts does for Discord API
  console.log("[ImmichSave] Testing with fetch (like MoreAlts) to:", `${serverUrl}/api/albums`);
  
  fetch(`${serverUrl}/api/albums`, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  .then(response => {
    console.log("[ImmichSave] Fetch Response:", response.status, response.statusText);
    
    if (response.status === 200 || response.status === 401) {
      showToast("✅ Fetch works! Connection successful!", getAssetIDByName("ic_check"));
    } else {
      showToast(`❌ Fetch failed: ${response.status}`, getAssetIDByName("ic_close_16px"));
    }
  })
  .catch(error => {
    console.error("[ImmichSave] Fetch failed, trying XHR:", error);
    
    // Fallback to XHR if fetch fails
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${serverUrl}/api/albums`, true);
    xhr.setRequestHeader('X-API-KEY', apiKey);
    xhr.setRequestHeader('Accept', 'application/json');
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        console.log("[ImmichSave] XHR Response:", xhr.status, xhr.statusText);
        
        if (xhr.status === 200 || xhr.status === 401) {
          showToast("✅ XHR works! Connection successful!", getAssetIDByName("ic_check"));
        } else if (xhr.status === 0) {
          showToast("❌ All requests blocked by Discord", getAssetIDByName("ic_close_16px"));
        } else {
          showToast(`❌ Connection failed: ${xhr.status}`, getAssetIDByName("ic_close_16px"));
        }
      }
    };
    
    xhr.onerror = function() {
      console.error("[ImmichSave] XHR also failed");
      showToast("❌ All network requests blocked", getAssetIDByName("ic_close_16px"));
    };
    
    xhr.timeout = 10000;
    xhr.send();
  });
};

const uploadToImmich = (fileUrl: string, filename: string): Promise<boolean> => {
  const apiKey = getApiKey();
  const serverUrl = getServerUrl();
  
  if (!apiKey || !serverUrl) {
    showToast("Immich not configured! Please set API key and server URL in settings.", getAssetIDByName("ic_close_16px"));
    return Promise.resolve(false);
  }

  // console.log("[ImmichSave] Downloading file:", fileUrl);
  
  return fetch(fileUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => {
      // console.log("[ImmichSave] Downloaded blob size:", blob.size);
      
      // Prepare form data for Immich API - all required fields
      const formData = new FormData();
      formData.append('assetData', blob, filename);
      formData.append('deviceAssetId', `discord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      formData.append('deviceId', 'vendetta-discord');
      formData.append('fileCreatedAt', new Date().toISOString());
      formData.append('fileModifiedAt', new Date().toISOString());
      formData.append('filename', filename);
      // Add empty metadata array as required
      formData.append('metadata', JSON.stringify([]));
      
      // Upload to Immich
      console.log("[ImmichSave] Uploading to Immich:", `${serverUrl}/api/asset/upload`);
      console.log("[ImmichSave] API Key length:", apiKey.length);
      console.log("[ImmichSave] FormData prepared with keys:", ['assetData', 'deviceAssetId', 'deviceId', 'fileCreatedAt', 'fileModifiedAt', 'filename', 'metadata']);
      console.log("[ImmichSave] Blob size:", blob.size, "bytes");
      
      // Try fetch first (like MoreAlts does), then fallback to XHR
      return fetch(`${serverUrl}/api/asset/upload`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          // Don't set Content-Type - let browser handle it for FormData
        },
        body: formData
      })
      .catch(error => {
        console.error("[ImmichSave] Fetch upload failed, trying XHR:", error);
        
        // Fallback to XMLHttpRequest if fetch fails
        return new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${serverUrl}/api/asset/upload`, true);
          xhr.setRequestHeader('X-API-KEY', apiKey);
          // Don't set Content-Type - let XMLHttpRequest handle it for FormData
          
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              console.log("[ImmichSave] Upload XHR Response:", xhr.status, xhr.statusText);
              
              const response = {
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                text: () => Promise.resolve(xhr.responseText)
              };
              
              if (response.ok) {
                console.log("[ImmichSave] Upload successful via XHR");
              }
              
              resolve(response);
            }
          };
          
          xhr.onerror = function() {
            console.error("[ImmichSave] Upload XHR Error");
            reject(new Error('Network request failed'));
          };
          
          xhr.ontimeout = function() {
            console.error("[ImmichSave] Upload XHR Timeout");
            reject(new Error('Request timeout'));
          };
          
          xhr.timeout = 30000; // 30 second timeout for uploads
          xhr.send(formData);
        });
      });
    })
    .then(uploadResponse => {
      if (!uploadResponse.ok) {
        return uploadResponse.text().then(errorText => {
          throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        });
      }
      // console.log("[ImmichSave] Upload successful");
      return true;
    })
    .catch(error => {
      console.error('[ImmichSave] Upload error:', error);
      console.error('[ImmichSave] Error type:', error.constructor.name);
      console.error('[ImmichSave] Error stack:', error.stack);
      
      let errorMessage = 'Unknown error occurred';
      
      if (error.message.includes('Network request failed')) {
        errorMessage = 'Cannot connect to Immich server. Check your server URL and network connection.';
      } else if (error.message.includes('Upload failed: 401')) {
        errorMessage = 'Invalid API key. Please check your Immich API key in settings.';
      } else if (error.message.includes('Upload failed: 403')) {
        errorMessage = 'Access denied. Check your API key permissions.';
      } else if (error.message.includes('Upload failed: 404')) {
        errorMessage = 'Immich API endpoint not found. Check your server URL.';
      } else if (error.message.includes('Upload failed: 500')) {
        errorMessage = 'Immich server error. Check server logs.';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }
      
      showToast(`Failed to save: ${errorMessage}`, getAssetIDByName("ic_close_16px"));
      return false;
    });
};

const saveMediaFromMessage = (message: any): void => {
  if (!isConfigured()) {
    showToast("Please configure Immich settings first!", getAssetIDByName("ic_close_16px"));
    return;
  }

  const attachments = message.attachments;
  if (!attachments || attachments.length === 0) {
    showToast("No media found in this message", getAssetIDByName("ic_close_16px"));
    return;
  }

  // Filter for images and videos
  const mediaAttachments = attachments.filter((att: any) => {
    const isImage = att.content_type?.startsWith('image/') || 
                   /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.filename);
    const isVideo = att.content_type?.startsWith('video/') || 
                   /\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|wmv)$/i.test(att.filename);
    return isImage || isVideo;
  });

  if (mediaAttachments.length === 0) {
    showToast("No image or video attachments found", getAssetIDByName("ic_close_16px"));
    return;
  }

  // console.log("[ImmichSave] Found media attachments:", mediaAttachments.length);
  showToast(`Uploading ${mediaAttachments.length} file(s) to Immich...`, getAssetIDByName("ic_upload"));

  let successCount = 0;
  let failCount = 0;
  let completedCount = 0;

  const processAttachment = (attachment: any) => {
    return uploadToImmich(attachment.url, attachment.filename)
      .then(success => {
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        completedCount++;
        
        // Show progress for multiple files
        if (mediaAttachments.length > 1) {
          showToast(`Progress: ${completedCount}/${mediaAttachments.length} files processed`, getAssetIDByName("ic_check"));
        }
        
        // Check if all attachments have been processed
        if (completedCount === mediaAttachments.length) {
          // Show final result
          if (successCount > 0) {
            showToast(`Successfully saved ${successCount} file(s) to Immich!`, getAssetIDByName("ic_check"));
          }
          if (failCount > 0) {
            showToast(`Failed to save ${failCount} file(s)`, getAssetIDByName("ic_close_16px"));
          }
        }
      })
      .catch(error => {
        // console.error("[ImmichSave] Error processing attachment:", error);
        failCount++;
        completedCount++;
        
        // Check if all attachments have been processed
        if (completedCount === mediaAttachments.length) {
          // Show final result
          if (successCount > 0) {
            showToast(`Successfully saved ${successCount} file(s) to Immich!`, getAssetIDByName("ic_check"));
          }
          if (failCount > 0) {
            showToast(`Failed to save ${failCount} file(s)`, getAssetIDByName("ic_close_16px"));
          }
        }
      });
  };

  // Process all attachments
  mediaAttachments.forEach(attachment => {
    processAttachment(attachment);
  });
};


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
      React.createElement(Forms.FormText, { style: { marginBottom: 10, marginLeft: 10 } }, 
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
      }),
      React.createElement(Forms.FormRow, {
        label: "Test Connection",
        onPress: testImmichConnection
      })
    ),
    
    React.createElement(Forms.FormSection, { title: "Status" },
      React.createElement(Forms.FormText, { style: { marginBottom: 10, marginLeft: 10 } }, 
        isConfigured() ? "✅ Immich is configured and ready to use!" : "❌ Please configure Immich settings above"
      )
    )
  );
};

export default {
   onLoad: () => {
        // console.log("[ImmichSave] Plugin loaded!");
        
        if (ActionSheet) {
          // console.log("[ImmichSave] Found ActionSheet component, patching render method");
          unpatchActionSheet = before("render", ActionSheet, (args) => {
            try {
              const [props] = args;
              
              // Log ActionSheet details for debugging - explore the full structure
              // console.log("[ImmichSave] ActionSheet render - full props:", {
              //   sheetKey: props.sheetKey,
              //   hasOptions: !!props.options,
              //   optionsCount: props.options?.length || 0,
              //   allPropKeys: Object.keys(props),
              //   hasMessage: !!props.message,
              //   hasContent: !!props.content,
              //   hasData: !!props.data,
              //   title: props.title,
              //   header: props.header
              // });
              
              // Extract message from the header props (based on the log structure we saw)
              const message = props.header?.props?.message;
              
              if (!message) {
                // console.log("[ImmichSave] Skipping ActionSheet - no message found in header.props");
                return;
              }
              
              // Check if message has image or video attachments
              const hasMediaAttachments = message.attachments?.some((att: any) => {
                const isImage = att.content_type?.startsWith('image/') || 
                               /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.filename);
                const isVideo = att.content_type?.startsWith('video/') || 
                               /\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|wmv)$/i.test(att.filename);
                return isImage || isVideo;
              });
              
              if (!hasMediaAttachments) {
                // console.log("[ImmichSave] Skipping - no image or video attachments found");
                return;
              }
              
              // console.log("[ImmichSave] Found message with media attachments - proceeding");
              
              // Debug the children structure since options is undefined
              // console.log("[ImmichSave] Children debug:", {
              //   hasChildren: !!props.children,
              //   childrenType: typeof props.children,
              //   childrenIsArray: Array.isArray(props.children),
              //   childrenLength: props.children?.length,
              //   children: props.children
              // });
              
              // Now let's try to add our ActionSheetRow to the children
              if (props.children && Array.isArray(props.children) && ActionSheetRow) {
                // console.log("[ImmichSave] Attempting to add ActionSheetRow to children");
                
                // Check if our option already exists
                const hasImmichOption = props.children.some(child => 
                  child?.props?.label === "Save to Immich"
                );
                
                if (!hasImmichOption) {
                  // Create our ActionSheetRow component matching the structure we saw
                  const saveToImmichRow = React.createElement(ActionSheetRow, {
                    key: "save-to-immich",
                    label: "Save to Immich",
                    icon: getAssetIDByName("ic_download"),
                    onPress: () => {
                      try {
                        // console.log("[ImmichSave] Save to Immich pressed!");
                        saveMediaFromMessage(message);
                      } catch (e) {
                        console.error("[ImmichSave] Error in Save to Immich handler:", e);
                        showToast(`Failed to save: ${e.message || 'Unknown error'}`, getAssetIDByName("ic_close_16px"));
                      }
                    }
                  });
                  
                  // Add to the beginning of the children array
                  props.children.unshift(saveToImmichRow);
                  // console.log("[ImmichSave] Successfully added Save to Immich ActionSheetRow");
                } else {
                  // console.log("[ImmichSave] Save to Immich option already exists");
                }
              } else {
                // console.log("[ImmichSave] Cannot add ActionSheetRow:", {
                //   hasChildren: !!props.children,
                //   isArray: Array.isArray(props.children),
                //   hasActionSheetRow: !!ActionSheetRow
                // });
              }
            } catch (e) {
              console.error("[ImmichSave] ActionSheet patch error:", e);
            }
          });
        } else {
          // console.warn("[ImmichSave] Could not find ActionSheet component");
        }
   },
   onUnload: () => {
     if (unpatchActionSheet) {
       unpatchActionSheet();
     }
   },
   
   settings: SettingsComponent
};
