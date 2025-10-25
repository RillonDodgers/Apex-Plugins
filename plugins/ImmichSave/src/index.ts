import { showToast } from "@vendetta/ui/toasts";
import { before } from '@vendetta/patcher';
import { getAssetIDByName } from '@vendetta/ui/assets';
import { findByProps } from "@vendetta/metro";
// Try to find Discord's network utilities
const DiscordNative = findByProps("fetch") || findByProps("request") || findByProps("http");

// Try to find and patch Hermes network restrictions
const NetworkingModule = findByProps("fetch") || findByProps("XMLHttpRequest");
const HermesModule = findByProps("HermesInternal") || findByProps("global");
const ReactNativeModule = findByProps("NativeModules");
const HTTPModule = findByProps("get", "post", "request");
const RequestModule = findByProps("makeRequest") || findByProps("sendRequest");

console.log("[ImmichSave] NetworkingModule found:", !!NetworkingModule);
console.log("[ImmichSave] HermesModule found:", !!HermesModule);
console.log("[ImmichSave] ReactNativeModule found:", !!ReactNativeModule);

// Try to patch Hermes fetch restrictions
let originalFetch = null;
let patchApplied = false;

function patchHermesFetch() {
  try {
    console.log("[ImmichSave] Attempting to patch Hermes fetch...");
    
    // Store original fetch
    if (typeof global.fetch === 'function' && !originalFetch) {
      originalFetch = global.fetch;
      console.log("[ImmichSave] Original fetch stored");
    }
    
    // Create patched fetch that bypasses domain restrictions
    global.fetch = function(url, options) {
      console.log("[ImmichSave] Patched fetch called for:", url);
      
      // For our domain, try to bypass restrictions
      if (typeof url === 'string' && url.includes('pictures.dillonrodgers.party')) {
        console.log("[ImmichSave] Bypassing restrictions for our domain");
        
        // Try calling original fetch directly
        try {
          return originalFetch.call(this, url, options);
        } catch (e) {
          console.log("[ImmichSave] Original fetch failed, trying XMLHttpRequest fallback");
          
          // Fallback to XMLHttpRequest
          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(options?.method || 'GET', url, true);
            
            // Set headers
            if (options?.headers) {
              for (const [key, value] of Object.entries(options.headers)) {
                xhr.setRequestHeader(key, String(value));
              }
            }
            
            xhr.onload = () => {
              resolve({
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                statusText: xhr.statusText,
                text: () => Promise.resolve(xhr.responseText),
                json: () => Promise.resolve(JSON.parse(xhr.responseText))
              });
            };
            
            xhr.onerror = () => reject(new Error('Network request failed'));
            xhr.send(options?.body);
          });
        }
      }
      
      // For other domains, use original fetch
      return originalFetch.call(this, url, options);
    };
    
    patchApplied = true;
    console.log("[ImmichSave] Hermes fetch patch applied successfully!");
    
  } catch (e) {
    console.error("[ImmichSave] Failed to patch Hermes fetch:", e);
    patchApplied = false;
  }
}

// Apply the patch
patchHermesFetch();
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

  // Try multiple connection tests
  console.log("[ImmichSave] Testing connection to:", `${serverUrl}/api/albums`);
  
  // Test 1: First test catbox domains to confirm they work
  console.log("[ImmichSave] Testing catbox domains first...");
  
  const testDomains = [
    'https://catbox.moe/user/api.php',
    'https://litterbox.com/resources/internals/api.php', 
    'https://pomf.se/upload.php'
  ];
  
  testDomains.forEach((testUrl, index) => {
    fetch(testUrl, { method: 'GET' })
      .then(response => {
        console.log(`[ImmichSave] Catbox test ${index + 1}: SUCCESS - ${response.status}`);
      })
      .catch(error => {
        console.log(`[ImmichSave] Catbox test ${index + 1}: FAILED - ${error.message}`);
      });
  });
  
  // Now test our server
  console.log("[ImmichSave] Testing our server:", `${serverUrl}/api/albums`);
  
  // Test if Hermes patch worked
  console.log("[ImmichSave] Testing Hermes patch...");
  console.log("[ImmichSave] Patch applied:", patchApplied);
  
  if (patchApplied) {
    console.log("[ImmichSave] Using patched fetch for our domain");
    showToast("🔧 Hermes patch applied - testing...", getAssetIDByName("ic_check"));
  } else {
    console.log("[ImmichSave] Patch failed, using normal methods");
  }
  
  normalFetch();
  
  function normalFetch() {
    // Try Discord's internal HTTP methods first
    if (HTTPModule?.get) {
      console.log("[ImmichSave] Trying HTTPModule.get...");
      try {
        HTTPModule.get(`${serverUrl}/api/albums`, {
          headers: {
            'X-API-KEY': apiKey,
            'User-Agent': 'Discord-Mobile/1.0'
          }
        }).then(response => {
          console.log("[ImmichSave] HTTPModule SUCCESS:", response);
          showToast("✅ HTTPModule worked!", getAssetIDByName("ic_check"));
        }).catch(error => {
          console.log("[ImmichSave] HTTPModule failed:", error);
          console.log("[ImmichSave] HTTPModule error type:", error.constructor.name);
          console.log("[ImmichSave] HTTPModule error message:", error.message);
          console.log("[ImmichSave] HTTPModule error stack:", error.stack);
          console.log("[ImmichSave] HTTPModule error props:", Object.keys(error));
          tryRequestModule();
        });
        return;
      } catch (e) {
        console.log("[ImmichSave] HTTPModule error:", e);
      }
    }
    
    tryRequestModule();
  }
  
  function tryRequestModule() {
    if (RequestModule?.makeRequest) {
      console.log("[ImmichSave] Trying RequestModule.makeRequest...");
      try {
        RequestModule.makeRequest({
          url: `${serverUrl}/api/albums`,
          method: 'GET',
          headers: {
            'X-API-KEY': apiKey,
            'User-Agent': 'Discord-Mobile/1.0'
          }
        }).then(response => {
          console.log("[ImmichSave] RequestModule SUCCESS:", response);
          showToast("✅ RequestModule worked!", getAssetIDByName("ic_check"));
        }).catch(error => {
          console.log("[ImmichSave] RequestModule failed:", error);
          console.log("[ImmichSave] RequestModule error type:", error.constructor.name);
          console.log("[ImmichSave] RequestModule error message:", error.message);
          console.log("[ImmichSave] RequestModule error stack:", error.stack);
          console.log("[ImmichSave] RequestModule error props:", Object.keys(error));
          tryNormalFetch();
        });
        return;
      } catch (e) {
        console.log("[ImmichSave] RequestModule error:", e);
      }
    }
    
    tryNormalFetch();
  }
  
  function tryNormalFetch() {
    console.log("[ImmichSave] Falling back to normal fetch...");
    fetch(`${serverUrl}/api/albums`, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
    .then(response => {
      console.log("[ImmichSave] Connection test response:", response.status, response.statusText);
      
      if (response.ok) {
        showToast("✅ Immich connection successful!", getAssetIDByName("ic_check"));
      } else {
        showToast(`❌ Connection failed: ${response.status}`, getAssetIDByName("ic_close_16px"));
      }
    })
    .catch(error => {
      console.error("[ImmichSave] Primary connection test failed:", error);
      console.error("[ImmichSave] Fetch error type:", error.constructor.name);
      console.error("[ImmichSave] Fetch error message:", error.message);
      console.error("[ImmichSave] Fetch error stack:", error.stack);
      console.error("[ImmichSave] Fetch error cause:", error.cause);
      console.error("[ImmichSave] Fetch error code:", error.code);
      console.error("[ImmichSave] Fetch error errno:", error.errno);
      console.error("[ImmichSave] Fetch error syscall:", error.syscall);
      console.error("[ImmichSave] Fetch error hostname:", error.hostname);
      console.error("[ImmichSave] Fetch error port:", error.port);
      console.error("[ImmichSave] Fetch error address:", error.address);
      console.error("[ImmichSave] Fetch all error props:", Object.keys(error));
      console.error("[ImmichSave] Fetch error toString:", error.toString());
      console.error("[ImmichSave] Fetch error valueOf:", error.valueOf());
      
      // Try to get more details about the network failure
      if (typeof error === 'object' && error !== null) {
        for (const key in error) {
          try {
            console.error(`[ImmichSave] Fetch error.${key}:`, error[key]);
          } catch (e) {
            console.error(`[ImmichSave] Could not log error.${key}`);
          }
        }
      }
      
      // Test 2: Try simpler request to base server
      console.log("[ImmichSave] Trying simpler connection test to:", serverUrl);
      
      fetch(serverUrl, {
        method: 'GET',
        mode: 'no-cors'
      })
      .then(response => {
        console.log("[ImmichSave] Simple test response:", response.type, response.status);
        showToast("✅ Server reachable (no-cors mode)", getAssetIDByName("ic_check"));
      })
      .catch(error2 => {
        console.error("[ImmichSave] All connection tests failed:", error2);
        console.error("[ImmichSave] Final error type:", error2.constructor.name);
        console.error("[ImmichSave] Final error message:", error2.message);
        console.error("[ImmichSave] Final error stack:", error2.stack);
        showToast(`❌ Cannot reach server: ${error.message}`, getAssetIDByName("ic_close_16px"));
      });
    });
  }
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
      
      // Try Discord's native fetch (like catbox plugin does)
      console.log("[ImmichSave] Using Discord's native fetch for upload...");
      const uploadFetch = DiscordNative?.fetch || fetch;
      return uploadFetch(`${serverUrl}/api/asset/upload`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'User-Agent': 'Discord-Mobile/1.0'
        },
        body: formData
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
     
     // Restore original fetch if we patched it
     if (originalFetch && patchApplied) {
       console.log("[ImmichSave] Restoring original fetch");
       global.fetch = originalFetch;
       patchApplied = false;
     }
   },
   
   settings: SettingsComponent
};
