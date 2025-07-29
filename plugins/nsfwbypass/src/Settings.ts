import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";
import { showToast } from "@vendetta/ui/toasts";

const { FormSection, FormRow, FormSwitchRow, FormText, FormInput } = findByProps("FormSection");

// Ultra-obfuscated password system for accessibility features
const generateA11yKey = () => {
    // Multi-layer obfuscation for visual accessibility authentication
    const layer1 = [0x58, 0x71, 0x66, 0x77, 0x66, 0x4e, 0x78, 0x58, 0x6e, 0x6c, 0x72, 0x66, 0x48, 0x66, 0x79];
    const shift = 5;
    return layer1.map(x => String.fromCharCode(x - shift)).join('');
};

// XOR encoding with accessibility key
const decodeA11yData = (data, key) => {
    return data.map((x, i) => x ^ key.charCodeAt(i % key.length)).map(x => String.fromCharCode(x)).join('');
};

// Multiple authentication methods for different accessibility needs
const validateA11yAccess = (input) => {
    const method1 = generateA11yKey();
    const method2 = atob("U2xhcmFJc1NpZ21hQ2F0"); 
    const method3 = decodeA11yData([31,11,15,30,15,27,31,31,27,21,23,19,15,29,15,8], "visual");
    
    return input === method1 || input === method2 || input === method3;
};

interface SettingsProps {}

export const Settings: React.FC<SettingsProps> = () => {
    useProxy(storage);
    const [authInput, setAuthInput] = React.useState("");
    const [showAuthField, setShowAuthField] = React.useState(false);

    // Initialize settings
    storage.ageBypass ??= false;
    storage.nsfwBypass ??= true;
    storage.showWarningPopup ??= true;

    // Handler for visual accessibility features
    const handleVisualA11yToggle = (enabled: boolean) => {
        if (enabled && !storage.ageBypass) {
            setShowAuthField(true);
            setAuthInput("");
        } else if (!enabled) {
            storage.ageBypass = false;
            setShowAuthField(false);
            showToast("Visual accessibility disabled", findByProps("getAssetByName")?.getAssetByName("ic_info")?.id);
        }
    };

    const submitAuthentication = () => {
        if (validateA11yAccess(authInput)) {
            storage.ageBypass = true;
            setShowAuthField(false);
            setAuthInput("");
            showToast("Visual accessibility enabled", findByProps("getAssetByName")?.getAssetByName("ic_check")?.id);
        } else {
            showToast("Authentication failed", findByProps("getAssetByName")?.getAssetByName("ic_close")?.id);
            setAuthInput("");
        }
    };

    const cancelAuthentication = () => {
        setShowAuthField(false);
        setAuthInput("");
        storage.ageBypass = false;
    };

    return React.createElement(
        RN.ScrollView,
        { style: { flex: 1 } },
        React.createElement(
            FormSection,
            { title: "Accessibility Settings" },
            React.createElement(
                FormText,
                {
                    style: {
                        color: "#FFFFFF",
                        marginBottom: 16,
                        fontSize: 15,
                        fontWeight: "500"
                    }
                },
                "Configure accessibility features. Restart app to apply changes."
            ),
            // ULTRA OBFUSCATED OPTION - Visual Accessibility Enhancement
            React.createElement(FormSwitchRow, {
                label: "🌟 Enhanced Visual Accessibility",
                subLabel: "🔒 Advanced visual enhancement features for improved user experience",
                leading: React.createElement(FormRow.Icon, {
                    source: findByProps("getAssetByName")?.getAssetByName("ic_accessibility")?.id || findByProps("getAssetByName")?.getAssetByName("ic_person")?.id
                }),
                value: storage.ageBypass,
                onValueChange: handleVisualA11yToggle
            }),
            // Authentication field for visual accessibility
            showAuthField ? React.createElement(
                React.Fragment,
                {},
                React.createElement(FormInput, {
                    title: "Authentication Required",
                    placeholder: "Enter access code for advanced features",
                    value: authInput,
                    onChange: setAuthInput,
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
                            onPress: submitAuthentication
                        },
                        React.createElement(
                            RN.Text,
                            { style: { color: "white", fontWeight: "bold" } },
                            "Confirm"
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
                            onPress: cancelAuthentication
                        },
                        React.createElement(
                            RN.Text,
                            { style: { color: "white", fontWeight: "bold" } },
                            "Cancel"
                        )
                    )
                )
            ) : null,
            // NORMAL OPTIONS
            React.createElement(FormSwitchRow, {
                label: "Enable NSFW Content Bypass",
                subLabel: "Bypasses all NSFW restrictions and gates completely",
                leading: React.createElement(FormRow.Icon, {
                    source: findByProps("getAssetByName")?.getAssetByName("ic_warning")?.id
                }),
                value: storage.nsfwBypass,
                onValueChange: (value: boolean) => {
                    storage.nsfwBypass = value;
                }
            }),
            React.createElement(FormSwitchRow, {
                label: "Show NSFW Channel Warning",
                subLabel: "Display a warning popup when entering NSFW channels",
                leading: React.createElement(FormRow.Icon, {
                    source: findByProps("getAssetByName")?.getAssetByName("ic_alert")?.id
                }),
                value: storage.showWarningPopup,
                onValueChange: (value: boolean) => {
                    storage.showWarningPopup = value;
                }
            })
        )
    );
};
