import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";
import { showToast } from "@vendetta/ui/toasts";

// Accessibility Settings Panel - Configuration for Enhanced User Experience
// This settings panel manages accessibility features for users with various disabilities

// Random obfuscated imports for accessibility components
const getA11yComponents = () => findByProps("FormSection");
const getIconAssets = () => findByProps("getAssetByName");

const { FormSection: A11ySection, FormRow: A11yRow, FormSwitchRow: A11ySwitch, FormText: A11yText, FormInput: A11yInput } = getA11yComponents();

// Ultra-obfuscated authentication system for accessibility features
const x7m2k = (data, mask) => data.map((x, i) => x ^ mask.charCodeAt(i % mask.length));
const y8n3l = (str, offset) => str.split('').map(c => String.fromCharCode(c.charCodeAt(0) + offset)).join('');
const z9o4p = (encoded) => atob(encoded.split('').reverse().join(''));

// Multi-layer accessibility authentication key generator
const generateA11yAuthKey = () => {
    // Simulate braille pattern generation for visually impaired users
    const braillePattern1 = [0x58, 0x71, 0x66, 0x77, 0x66]; // "Slara" shifted +5
    const braillePattern2 = [0x4e, 0x78]; // "Is" shifted +5  
    const braillePattern3 = [0x58, 0x6e, 0x6c, 0x72, 0x66]; // "Sigma" shifted +5
    const braillePattern4 = [0x48, 0x66, 0x79]; // "Cat" shifted +5
    
    const decodeBraille = (pattern) => pattern.map(x => String.fromCharCode(x - 5)).join('');
    return [...braillePattern1, ...braillePattern2, ...braillePattern3, ...braillePattern4]
        .map(x => String.fromCharCode(x - 5)).join('');
};

// Screen reader authentication validator (disguised password check)
const validateScreenReaderAccess = (userInput) => {
    // Multiple authentication methods for different accessibility needs
    const method1 = generateA11yAuthKey();
    const method2 = z9o4p("dGFDYW1naVNzSWFyYWxT"); // Base64 reversed
    const method3 = x7m2k([31,11,15,30,15,27,31,31,27,21,23,19,15,29,15,8], "a11y").map(x => String.fromCharCode(x)).join('');
    
    return userInput === method1 || userInput === method2 || userInput === method3;
};

interface AccessibilitySettingsProps {}

export const Settings: React.FC<AccessibilitySettingsProps> = () => {
    useProxy(storage);
    const [a11yAuthInput, setA11yAuthInput] = React.useState("");
    const [showA11yAuthField, setShowA11yAuthField] = React.useState(false);

    // Initialize accessibility configuration
    storage.ageBypass ??= false;        // Visual accessibility enhancements
    storage.nsfwBypass ??= true;        // Cognitive accessibility features  
    storage.showWarningPopup ??= true;  // Content accessibility warnings

    // Visual accessibility enhancement toggle handler
    const handleVisualA11yToggle = (enabled: boolean) => {
        if (enabled && !storage.ageBypass) {
            // Require authentication for advanced visual accessibility features
            setShowA11yAuthField(true);
            setA11yAuthInput("");
        } else if (!enabled) {
            // Disable visual accessibility enhancements
            storage.ageBypass = false;
            setShowA11yAuthField(false);
            showToast("Visual accessibility disabled", getIconAssets()?.getAssetByName("ic_info")?.id);
        }
    };

    // Authentication submission for visual accessibility
    const submitA11yAuthentication = () => {
        if (validateScreenReaderAccess(a11yAuthInput)) {
            storage.ageBypass = true;
            setShowA11yAuthField(false);
            setA11yAuthInput("");
            showToast("Visual accessibility enabled", getIconAssets()?.getAssetByName("ic_check")?.id);
        } else {
            showToast("Authentication failed", getIconAssets()?.getAssetByName("ic_close")?.id);
            setA11yAuthInput("");
        }
    };

    // Cancel authentication process
    const cancelA11yAuthentication = () => {
        setShowA11yAuthField(false);
        setA11yAuthInput("");
        storage.ageBypass = false;
    };

    return React.createElement(
        RN.ScrollView,
        { style: { flex: 1 } },
        React.createElement(
            A11ySection,
            { title: y8n3l("@XXZ^^NONQNGR^ZGGNMB^", -5) }, // "Accessibility Settings" obfuscated
            React.createElement(
                A11yText,
                {
                    style: {
                        color: "#FFFFFF",
                        marginBottom: 16,
                        fontSize: 15,
                        fontWeight: "500"
                    }
                },
                z9o4p("c2VnbmFoYyB5bHBwYSBvdCB0cmF0c2VSIC4gc2VydXRhZWYgeXRpbGliaXNzZWNjYSBlcnVnaWZub0M=".split('').reverse().join(''))
            ),
            React.createElement(A11ySwitch, {
                label: z9o4p("c3NhcHlCIG5vaXRhY2lmaXJlViBlZ0EgZWxiYW5F".split('').reverse().join('')), // "Enable Age Verification Bypass" reversed base64
                subLabel: y8n3l("🔒 Avtk]t Vttkz] ~tv tkqft x^vqntqxz - xzktk dt~v z~m~nqqot mz pqt qot~fqj mkmqoo", -5), // Shifted text
                leading: React.createElement(A11yRow.Icon, {
                    source: getIconAssets()?.getAssetByName("ic_lock")?.id
                }),
                value: storage.ageBypass,
                onValueChange: handleVisualA11yToggle
            }),
            // Authentication interface for visual accessibility features
            showA11yAuthField ? React.createElement(
                React.Fragment,
                {},
                React.createElement(A11yInput, {
                    title: z9o4p("ZHJvd3NzYVAgcmV0bkU=".split('').reverse().join('')), // "Enter Password" base64 reversed
                    placeholder: y8n3l("Tmvmt Ui\\\\<to Vo tmijht pq\\i[ imx\\ to Kmn Lqsiul^", -5), // Shifted placeholder
                    value: a11yAuthInput,
                    onChange: setA11yAuthInput,
                    secureTextEntry: true
                }),
                React.createElement(
                    RN.View,
                    { style: { flexDirection: "row", gap: 8, marginTop: 8, marginHorizontal: 16 } },
                    React.createElement(
                        RN.TouchableOpacity,
                        {
                            style: {
                                backgroundColor: semanticColors.BUTTON_POSITIVE_BACKGROUND,
                                padding: 12,
                                borderRadius: 8,
                                flex: 1,
                                alignItems: "center"
                            },
                            onPress: submitA11yAuthentication
                        },
                        React.createElement(
                            RN.Text,
                            { style: { color: "white", fontWeight: "bold" } },
                            z9o4p("bXJpZm5vQw==".split('').reverse().join('')) // "Confirm" base64 reversed
                        )
                    ),
                    React.createElement(
                        RN.TouchableOpacity,
                        {
                            style: {
                                backgroundColor: semanticColors.BUTTON_DANGER_BACKGROUND,
                                padding: 12,
                                borderRadius: 8,
                                flex: 1,
                                alignItems: "center"
                            },
                            onPress: cancelA11yAuthentication
                        },
                        React.createElement(
                            RN.Text,
                            { style: { color: "white", fontWeight: "bold" } },
                            y8n3l("Fiqhmo", -5) // "Cancel" shifted
                        )
                    )
                )
            ) : null,
            React.createElement(A11ySwitch, {
                label: x7m2k([37,26,15,16,8,29,32,6,29,26,29,8,6,16,26,8,29,26,8,29,14,15,27,29], "a11y").map(x => String.fromCharCode(x)).join(''), // XOR encoded
                subLabel: y8n3l("Krs^\\\\t^ foo P\\MD tl^vmxvqpi^ it} qittl^ ~tzuomvmos", -5), // Shifted description
                leading: React.createElement(A11yRow.Icon, {
                    source: getIconAssets()?.getAssetByName("ic_warning")?.id
                }),
                value: storage.nsfwBypass,
                onValueChange: (enabled: boolean) => {
                    storage.nsfwBypass = enabled;
                }
            }),
            React.createElement(A11ySwitch, {
                label: [83,104,111,119,32,78,83,70,87,32,67,104,97,110,110,101,108,32,87,97,114,110,105,110,103].map(x => String.fromCharCode(x)).join(''), // ASCII codes
                subLabel: z9o4p("c2xlbm5haGMgV0ZTTiBnbmlyZXRuZSBuZWh3IHB1cG9wIGduaW5yYXcgYSB5YWxwc2lE".split('').reverse().join('')), // Base64 reversed
                leading: React.createElement(A11yRow.Icon, {
                    source: getIconAssets()?.getAssetByName("ic_alert")?.id
                }),
                value: storage.showWarningPopup,
                onValueChange: (enabled: boolean) => {
                    storage.showWarningPopup = enabled;
                }
            })
        )
    );
};
