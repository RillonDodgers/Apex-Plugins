import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";
import { showConfirmationAlert } from "@vendetta/ui/alerts";
import { showToast } from "@vendetta/ui/toasts";

const { FormSection, FormRow, FormSwitchRow, FormText, FormInput } = findByProps("FormSection");

// Use computational method
const AGE_BYPASS_PASSWORD = ((x) => String(x * 59 + 3))(5000);

interface SettingsProps {}

export const Settings: React.FC<SettingsProps> = () => {
    useProxy(storage);
    const [passwordInput, setPasswordInput] = React.useState("");
    const [showPasswordField, setShowPasswordField] = React.useState(false);

    // Initialize default values
    storage.ageBypass ??= false; // Default to false for password-protected feature
    storage.nsfwBypass ??= true;
    storage.showWarningPopup ??= true;

    const handleAgeBypassToggle = (value: boolean) => {
        if (value) {
            // Show password field instead of alert
            setShowPasswordField(true);
            setPasswordInput("");
        } else {
            // User is disabling - no password needed
            storage.ageBypass = false;
            setShowPasswordField(false);
            showToast("Age bypass disabled", findByProps("getAssetByName")?.getAssetByName("ic_info")?.id);
        }
    };

    const handlePasswordSubmit = () => {
        if (passwordInput === AGE_BYPASS_PASSWORD) {
            storage.ageBypass = true;
            setShowPasswordField(false);
            setPasswordInput("");
            showToast("Age bypass enabled successfully", findByProps("getAssetByName")?.getAssetByName("ic_check")?.id);
        } else {
            showToast("Incorrect password", findByProps("getAssetByName")?.getAssetByName("ic_close")?.id);
            setPasswordInput("");
        }
    };

    const handlePasswordCancel = () => {
        setShowPasswordField(false);
        setPasswordInput("");
        storage.ageBypass = false; // Ensure it stays disabled if cancelled
    };

    return React.createElement(
        RN.ScrollView,
        { style: { flex: 1 } },
        React.createElement(
            FormSection,
            { title: "NSFW Plugin Settings" },
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
                "Configure NSFW plugin settings. Restart the app to apply changes."
            ),
            React.createElement(FormSwitchRow, {
                label: "Enable Age Verification Bypass",
                subLabel: "🔒 Password protected - Sets your account as verified adult",
                leading: React.createElement(FormRow.Icon, {
                    source: findByProps("getAssetByName")?.getAssetByName("ic_lock")?.id
                }),
                value: storage.ageBypass,
                onValueChange: handleAgeBypassToggle
            }),
            // Show password input field when needed
            showPasswordField ? React.createElement(
                React.Fragment,
                {},
                React.createElement(FormInput, {
                    title: "Enter Password",
                    placeholder: "Enter password to enable age bypass",
                    value: passwordInput,
                    onChange: setPasswordInput,
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
                            onPress: handlePasswordSubmit
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
                            onPress: handlePasswordCancel
                        },
                        React.createElement(
                            RN.Text,
                            { style: { color: "white", fontWeight: "bold" } },
                            "Cancel"
                        )
                    )
                )
            ) : null,
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
