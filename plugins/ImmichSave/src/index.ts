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

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}
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

  fetch(`${serverUrl}/api/albums`, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json'
    }
  })
  .then(response => {
    if (response.status === 200 || response.status === 401) {
      showToast("✅ Immich connection successful!", getAssetIDByName("ic_check"));
    } else {
      showToast(`❌ Connection failed: ${response.status}`, getAssetIDByName("ic_close_16px"));
    }
  })
  .catch(error => {
    showToast(`❌ Cannot reach server: ${error.message}`, getAssetIDByName("ic_close_16px"));
  });
};

const uploadToImmich = (fileUrl: string, filename: string): Promise<boolean> => {
  const apiKey = getApiKey();
  const serverUrl = getServerUrl();
  
  if (!apiKey || !serverUrl) {
    showToast("Immich not configured! Please set API key and server URL in settings.", getAssetIDByName("ic_close_16px"));
    return Promise.resolve(false);
  }

  
  console.log('[ImmichSave] Starting upload for:', filename);
  console.log('[ImmichSave] File URL:', fileUrl);
  console.log('[ImmichSave] Server URL:', serverUrl);
  console.log('[ImmichSave] API Key length:', apiKey.length);
  
  return fetch(fileUrl)
    .then(response => {
      console.log('[ImmichSave] File download response:', response.status, response.statusText);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => {
      console.log('[ImmichSave] Downloaded blob size:', blob.size, 'bytes');
      console.log('[ImmichSave] Blob type:', blob.type);
      
      // Inspect the actual blob content for debugging
      return blob.arrayBuffer().then(buffer => {
        const uint8Array = new Uint8Array(buffer);
        
        // Log first 20 bytes as hex to see if content is actually different
        const firstBytes = Array.from(uint8Array.slice(0, 20))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
        console.log('[ImmichSave] First 20 bytes (hex):', firstBytes);
        
        // Calculate a simple checksum of first 100 bytes
        let checksum = 0;
        for (let i = 0; i < Math.min(100, uint8Array.length); i++) {
          checksum = (checksum + uint8Array[i]) % 65536;
        }
        console.log('[ImmichSave] Simple checksum (first 100 bytes):', checksum);
        
        // Convert back to blob for upload
        return new Blob([buffer], { type: blob.type });
      });
    })
    .then(blob => {
      const formData = new FormData();

      // Create proper File object from blob (Immich requires File, not raw blob)
      const file = new File([blob], filename, { 
        type: blob.type || 'application/octet-stream',
        lastModified: Date.now()
      });

      formData.append('assetData', file);

      // Extract numbers from filename as deviceAssetId
      const numbersFromFilename = filename.match(/\d+/g)?.join('') || uuidv4();
      formData.append('deviceAssetId', numbersFromFilename);
      formData.append('deviceId', 'discord');

      // Use current time for both created/modified (we don't have original file stats)
      const now = new Date().toISOString();
      formData.append('fileCreatedAt', now);
      formData.append('fileModifiedAt', now);

      // Add fileSize - this is crucial for binary integrity!
      formData.append('fileSize', String(blob.size));
      formData.append('isFavorite', 'false');
      
      console.log('[ImmichSave] Uploading to:', `${serverUrl}/api/assets`);
      
      return fetch(`${serverUrl}/api/assets`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json'
        },
        body: formData
      });
    })
    .then(uploadResponse => {
      console.log('[ImmichSave] Upload response status:', uploadResponse.status, uploadResponse.statusText);
      console.log('[ImmichSave] Upload response headers:', Object.fromEntries(uploadResponse.headers.entries()));
      
      if (!uploadResponse.ok) {
        return uploadResponse.text().then(errorText => {
          console.log('[ImmichSave] Upload error response body:', errorText);
          throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        });
      }
      
      return uploadResponse.text().then(responseText => {
        console.log('[ImmichSave] Upload success response:', responseText);
        return true;
      });
    })
    .catch(error => {
      console.error('[ImmichSave] Upload error:', error);
      console.error('[ImmichSave] Error message:', error.message);
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
        
        if (mediaAttachments.length > 1) {
          showToast(`Progress: ${completedCount}/${mediaAttachments.length} files processed`, getAssetIDByName("ic_check"));
        }
        
        if (completedCount === mediaAttachments.length) {
          if (successCount > 0) {
            showToast(`Successfully saved ${successCount} file(s) to Immich!`, getAssetIDByName("ic_check"));
          }
          if (failCount > 0) {
            showToast(`Failed to save ${failCount} file(s)`, getAssetIDByName("ic_close_16px"));
          }
        }
      })
      .catch(error => {
        failCount++;
        completedCount++;
        
        if (completedCount === mediaAttachments.length) {
          if (successCount > 0) {
            showToast(`Successfully saved ${successCount} file(s) to Immich!`, getAssetIDByName("ic_check"));
          }
          if (failCount > 0) {
            showToast(`Failed to save ${failCount} file(s)`, getAssetIDByName("ic_close_16px"));
          }
        }
      });
  };

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
        
        if (ActionSheet) {
          unpatchActionSheet = before("render", ActionSheet, (args) => {
            try {
              const [props] = args;
              
              const message = props.header?.props?.message;
              
              if (!message) {
                return;
              }
              
              const hasMediaAttachments = message.attachments?.some((att: any) => {
                const isImage = att.content_type?.startsWith('image/') || 
                               /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.filename);
                const isVideo = att.content_type?.startsWith('video/') || 
                               /\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|wmv)$/i.test(att.filename);
                return isImage || isVideo;
              });
              
              if (!hasMediaAttachments) {
                return;
              }
              
              
              
              if (props.children && Array.isArray(props.children) && ActionSheetRow) {
                
                const hasImmichOption = props.children.some(child => 
                  child?.props?.label === "Save to Immich"
                );
                
                if (!hasImmichOption) {
                  const saveToImmichRow = React.createElement(ActionSheetRow, {
                    key: "save-to-immich",
                    label: "Save to Immich",
                    icon: getAssetIDByName("ic_download"),
                    onPress: () => {
                      try {
                        saveMediaFromMessage(message);
                      } catch (e) {
                        console.error("[ImmichSave] Error in Save to Immich handler:", e);
                        showToast(`Failed to save: ${e.message || 'Unknown error'}`, getAssetIDByName("ic_close_16px"));
                      }
                    }
                  });
                  
                  props.children.unshift(saveToImmichRow);
                }
              }
            } catch (e) {
              console.error("[ImmichSave] ActionSheet patch error:", e);
            }
          });
        }
   },
   onUnload: () => {
     if (unpatchActionSheet) {
       unpatchActionSheet();
     }
   },
   
   settings: SettingsComponent
};
