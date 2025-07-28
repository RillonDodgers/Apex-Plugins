import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

const { FormSection, FormRow, FormText, FormSwitchRow } = Forms;

export default () => {
    return (
        <FormSection title="🎵 Rickroll Plugin Settings">
            <FormRow
                label="How to use"
                trailing={FormRow.Arrow}
            >
                <FormText>
                    Type "/rick" or "/rickroll" in any channel to rickroll everyone! 
                    The command will be replaced with rickroll text and play the iconic sound.
                </FormText>
            </FormRow>
            
            <FormRow
                label="Features"
                trailing={FormRow.Arrow}
            >
                <FormText>
                    • Plays "Never Gonna Give You Up" audio{'\n'}
                    • Replaces your message with rickroll text{'\n'}
                    • Works in any Discord channel{'\n'}
                    • Multiple backup audio sources{'\n'}
                    • Fallback beep sound if audio fails
                </FormText>
            </FormRow>
            
            <FormRow
                label="Pro Tips"
                trailing={FormRow.Arrow}
            >
                <FormText>
                    • Use "/rick" for a quick rickroll{'\n'}
                    • Perfect for pranking friends{'\n'}
                    • The element of surprise is key!{'\n'}
                    • Great for lightening the mood{'\n'}
                    • Rick Astley would be proud 🕺
                </FormText>
            </FormRow>
            
            <FormRow
                label="Warning"
                trailing={FormRow.Arrow}
            >
                <FormText style={{color: '#ff6b6b'}}>
                    Use responsibly! Don't spam rickrolls or your friends might get annoyed. 
                    Remember: with great power comes great ricksponsibility! 🎵
                </FormText>
            </FormRow>
        </FormSection>
    );
};
