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

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

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

// Helper function to create a cache file path
const getCacheFilePath = (filename: string): string => {
  const timestamp = Date.now();
  return `/tmp/immich_cache_${timestamp}_${uuidv4()}_${filename}`;
};

// Helper function to cache blob directly
const writeBlobToCache = (blob: Blob, cachePath: string): Promise<void> => {
  return new Promise((resolve) => {
    // Store the blob directly in cache without conversion
    if (typeof window !== 'undefined') {
      (window as any).__immichCache = (window as any).__immichCache || {};
      (window as any).__immichCache[cachePath] = blob;
    } else {
      (globalThis as any).__immichCache = (globalThis as any).__immichCache || {};
      (globalThis as any).__immichCache[cachePath] = blob;
    }
    
    resolve();
  });
};

// Helper function to read cached blob
const readCacheAsBlob = (cachePath: string): Blob => {
  const cache = (globalThis as any).__immichCache || (typeof window !== 'undefined' ? (window as any).__immichCache : {});
  const blob = cache[cachePath];
  
  if (!blob) {
    throw new Error(`Cache file not found: ${cachePath}`);
  }
  
  return blob;
};

// Helper function to delete cached file
const deleteCacheFile = (cachePath: string): void => {
  try {
    const cache = (globalThis as any).__immichCache || (typeof window !== 'undefined' ? (window as any).__immichCache : {});
    if (cache[cachePath]) {
      delete cache[cachePath];
      console.log('[ImmichSave] Cleaned up cache file:', cachePath);
    }
  } catch (error) {
    console.warn('[ImmichSave] Failed to cleanup cache file:', cachePath, error);
  }
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
  
  const cachePath = getCacheFilePath(filename);
  console.log('[ImmichSave] Cache path:', cachePath);
  
  return fetch(fileUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImmichSave/1.0)',
      }
    })
    .then(response => {
      console.log('[ImmichSave] File download response:', response.status, response.statusText);
      console.log('[ImmichSave] Content-Length:', response.headers.get('content-length'));
      console.log('[ImmichSave] Content-Type:', response.headers.get('content-type'));
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }
      
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) === 0) {
        throw new Error('Server returned empty file (Content-Length: 0)');
      }
      
      return response.blob();
    })
    .then((blob) => {
      console.log('[ImmichSave] Downloaded blob size:', blob.size, 'bytes');
      console.log('[ImmichSave] Downloaded blob type:', blob.type);
      
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty (0 bytes)');
      }
      
      // Save to cache
      console.log('[ImmichSave] Writing to cache...');
      return writeBlobToCache(blob, cachePath).then(() => {
        console.log('[ImmichSave] File cached successfully');
        
        // Verify cache by reading it back
        const cachedBlob = readCacheAsBlob(cachePath);
        console.log('[ImmichSave] Verified cached file size:', cachedBlob.size, 'bytes');
        
        if (cachedBlob.size !== blob.size) {
          throw new Error(`Cache verification failed: expected ${blob.size} bytes, got ${cachedBlob.size} bytes`);
        }
        
        // Create FormData with the cached blob
        const formData = new FormData();
        formData.append('assetData', cachedBlob, filename);

        // Create unique deviceAssetId using filename numbers + file size + timestamp
        const numbersFromFilename = filename.match(/\d+/g)?.join('') || '';
        const uniqueId = `${numbersFromFilename}-${cachedBlob.size}-${Date.now()}`;
        formData.append('deviceAssetId', uniqueId);
        formData.append('deviceId', 'discord-mobile-v2');

        // Use current time for both created/modified (we don't have original file stats)
        const now = new Date().toISOString();
        formData.append('fileCreatedAt', now);
        formData.append('fileModifiedAt', now);

        // Add fileSize - this is crucial for binary integrity!
        formData.append('fileSize', String(cachedBlob.size));

        console.log('[ImmichSave] FormData prepared with cached file');
        console.log('[ImmichSave] Uploading to:', `${serverUrl}/api/assets`);
        
        return fetch(`${serverUrl}/api/assets`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json'
            // Don't set Content-Type - let browser handle multipart/form-data boundary
          },
          body: formData
        });
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
    })
    .finally(() => {
      // Always cleanup the cache file, regardless of success or failure
      deleteCacheFile(cachePath);
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
