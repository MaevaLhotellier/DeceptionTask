import {
  ExperimentTemplate,
  StageConfig,
  createComprehensionStage,
  createExperimentConfig,
  createExperimentTemplate,
  createInfoStage,
  createMetadataConfig,
  createMultipleChoiceComprehensionQuestion,
  createMultipleChoiceItem,
  createMultipleChoiceSurveyQuestion,
  createScaleSurveyQuestion,
  createSenderReceiverStage,
  createStageTextConfig,
  createSurveyStage,
  createTextSurveyQuestion,
  createTOSStage,
  createTransferStage,
  AutoTransferType,
  createCohortParticipantConfig,
  createPayoutStage,
  createSenderReceiverPayoutItem,
  createScaleSurveyPayoutItem,
  createConditionGroup,
  PayoutCurrency,
  SenderReceiverPayoutItemData,
  createComparisonCondition,
  ComparisonOperator,
} from '@deliberation-lab/utils';
import {create} from 'domain';

// ****************************************************************************
// Metadata
// ****************************************************************************

export const SIGNALING_GAME_2X2_METADATA = createMetadataConfig({
  name: 'Signaling Game',
  publicName: 'Experiment_HRL_0408',
  description: 'Create a Signaling game',
});

// ****************************************************************************
// Template entry point
// ****************************************************************************

export function getSignalingGame2x2Template(): ExperimentTemplate {
  const stageConfigs = getSignalingGame2x2StageConfigs();
  return createExperimentTemplate({
    experiment: createExperimentConfig(stageConfigs, {
      metadata: SIGNALING_GAME_2X2_METADATA,
    }),
    stageConfigs,
  });
}

export function getSignalingGame2x2StageConfigs(): StageConfig[] {
  return [
    TOS_STAGE,
    DEMOGRAPHIC_SURVEY_STAGE,
    Sound_CHECK_STAGE,
    INTRO_STAGE,
    INTRO_STAGE_2,
    INTRO_STAGE_3,
    TRANSFER_STAGE,
    TUTORIAL,
    INTRO_STAGE_4,
    INTRO_STAGE_5,
    COMPREHENSION_STAGE,
    SG_Block1,
    ...getGameTransferStages('Block 2', 1),
    SG_Block2,
    ...getGameTransferStages('Block 3', 2),
    SG_Block3,
    INTRO_BEFORE_SURVEY_STAGE,
    SURVEY_STAGE1,
    SURVEY_STAGE3,
    SURVEY_STAGE2,
    PAYOUT_STAGE,
    COMMUNICATION_STAGE,
  ];
}
// ****************************************************************************
// TOSstage
// ****************************************************************************
const TOS_STAGE = createTOSStage({
  id: 'sg_tos',
  name: 'Terms of Service',
  tosLines: [
    `# **General Information**

You are about to participate in the research study entitled: **« Strategic Interactions Between Two Players »**.
Researcher in charge: **Pr. Stefano PALMINTERI**.

This study aims to understand the processes in multi-player decision-making. Its fundamental purpose is to investigate the cognitive mechanisms of learning and decision-making processes.

# **Procedure**
You will be asked to perform some experimental tests and answer several simple questionnaires. Your internet-based participation will require approximately **50 minutes**.

# **Voluntary Participation And Confidentiality**
Your participation is voluntary. During your participation, the researchers will collect coded data that preserves your anonymity.

# **Contact**
Email: [hrl.experiences@gmail.com](mailto:hrl.experiences@gmail.com)

---

By clicking the consent button below, you assert that:

* **You have read and understood the information above**
* **You understand that your participation is voluntary and you are free to withdraw at any time without giving a reason**
* **You agree to take part in this study**


After clicking the consent button, you will be  able to click "Next stage" on the bottom right corner to proceed.
  `,
  ],
});
// ****************************************************************************
// Transfer stage
// ****************************************************************************

const TRANSFER_STAGE = createTransferStage({
  id: 'sg_transfer',
  name: 'Lobby 1 – Waiting for partner',
  autoTransferConfig: {
    type: AutoTransferType.DEFAULT,
    minParticipants: 2,
    maxParticipants: 2,
    autoCohortParticipantConfig: createCohortParticipantConfig(),
  },
});
function getGameTransferStages(toGame: string, index: number): StageConfig[] {
  return [
    // Stage 1: Wait for 4 participants before moving to next round
    createTransferStage({
      id: `sg_game_transfer_${index}`,
      name: 'Waiting for next round...',
      autoTransferConfig: null,
    }),
    // Stage 2: Acquire participant's role from the previous game
    /*createSurveyStage({
      id: `sg_role_survey_${index}`,
      name: 'Your Role',
      descriptions: createStageTextConfig({
        primaryText: `The system has recorded your role from the previous game. Please click Next to enter the matching lobby for the next block.`,
      }),

      questions: [
        createMultipleChoiceSurveyQuestion({
          id: `role_question_${index}`,
          questionTitle: 'What was your role in the previous game?',
          condition: createComparisonCondition(
            {stageId: 'never', questionId: 'never'},
            ComparisonOperator.EQUALS,
            'never',
          ),
          options: [
            createMultipleChoiceItem({
              id: 'sender_choice',
              text: 'Advisor (Sender)',
            }),
            createMultipleChoiceItem({
              id: 'receiver_choice',
              text: 'Vendor (Receiver)',
            }),
          ],
          correctAnswerId: null,
        }),
      ],*/

    // Stage 3: Match 1 sender + 1 receiver into a new cohort for the next game
    /*createTransferStage({
      id: `sg_lobby_transfer_${index}`,
      name: `Finding partner for ${toGame}...`,
      autoTransferConfig: {
        type: AutoTransferType.SURVEY,
        surveyStageId: `sg_role_survey_${index}`,
        surveyQuestionId: `role_question_${index}`,
        participantCounts: {
          sender_choice: 1,
          receiver_choice: 1,
        },
        autoCohortParticipantConfig: createCohortParticipantConfig(),
      },
    }),
  ];*/
  ];
}

// ****************************************************************************
// Intro stage
// ****************************************************************************
const Sound_CHECK_STAGE = createInfoStage({
  id: 'sg_sound_check',
  name: 'Audio Check',
  infoLines: [
    `# 🎧 Audio Check
Please ensure your audio is turned on. Since this is a multiplayer game, there will be waiting times; we will play a sound to alert you when it is your turn to act. \\
After hearing the audio, click the 'I can hear the sound' confirmation button. \\
Then, use the 'Next stage' button at the bottom right of your screen to move forward.
`,
  ],
  enableAudioCheck: true,
});
const INTRO_STAGE = createInfoStage({
  id: 'sg_intro',
  name: 'General Introduction',
  infoLines: [
    `# **General Introduction**
In this experiment, you will participate in a two-person interaction involving a simulated market. You will take on a specific role and make decisions to earn real monetary rewards.
There are two roles:


## **1. Advisor**
They have **insider info**. They know the true state of the market and send a message to advise the Vendor on which market to choose. The Advisor doesn't make the final decision.

## **2. Vendor**
They receive the Advisor's message and must choose which market to enter. Their decision determines the final earnings for **both** them and the Advisor.



---
Click "Next stage" to see more details about the markets.`,
  ],
});

// ****************************************************************************
// Intro info stage 2
// ****************************************************************************

const INTRO_STAGE_2 = createInfoStage({
  id: 'sg_intro_2',
  name: 'Market Introduction',
  infoLines: [
    `# 🧺 **Market Introduction**

There are two different markets. The earnings associated with each market will remain the same throughout the whole game.

## **1. Market Alpha**
This always has the same number of clients, meaning the earnings for the Vendor and for the Advisor are always fixed.

## **2. Market Beta**
This market has two possible states: half of the time it is **Busy**, and the other half it is **Quiet**. Earnings depend on which state is active on that day.

> **Important Note:** The Advisor has the insider information and is the only person who knows in advance whether Market Beta is busy or quiet on any given day.

`,
  ],
});

// ****************************************************************************
// Intro info stage 3
// ****************************************************************************

const INTRO_STAGE_3 = createInfoStage({
  id: 'sg_intro_3',
  name: 'Timing & Automated Actions',
  infoLines: [
    `**In each round, you have 15 Seconds to make your choice.**

---

## 1. If the Advisor does not answer on time

If the Advisor does not answer on time, the system will **automatically send a message** for them. The likelihood of each message being sent depends on the game and this will be clearly shown in the instruction box before each block.

<br>

## 2. If the Vendor does not answer on time

If the Vendor does not answer on time, the system will **randomly pick a market** for them.

<br>

In both cases, the player who did not answer on time will receive **0 points** for that round, while the other player will still receive the normal payoff from the chosen market.

---

We will now walk you through a tutorial, which is not timed, so take your time. Please take a moment to read the instruction boxes during the tutorial; they contain essential details.

Click "Next stage" to see the tutorial.
`,
  ],
});

// ****************************************************************************
// Intro info stage 4
// ****************************************************************************

const INTRO_STAGE_4 = createInfoStage({
  id: 'sg_intro_4',
  name: 'Your Earnings',
  infoLines: [
    `
Your final payment consists of **two components**:

- **A fixed base fee** of **£6** for completing the study.
- **A choice bonus** based on the **total earnings you accumulate during the rounds**.

Points are converted at **100 points = £0.41**. Since you can earn up to **450 points per block** (15 rounds), across **3 blocks** plus a **questionnaire bonus**, your total bonus can reach up to **£6**.

The **more points you earn in the game**, the **higher your final bonus will be**.

`,
  ],
});

// ****************************************************************************
// Intro info stage 5
// ****************************************************************************

const INTRO_STAGE_5 = createInfoStage({
  id: 'sg_intro_5',
  name: 'Game structure',
  infoLines: [
    `

You will play the game **3 times in total**.

In each game, you will play with the same partner for **15 rounds** (representing 15 days in the market).

After each game, you will be rematched with another participant and play again.

You will keep the role that you were assigned in the first block for all 3 games (Vendor or Advisor).
`,
  ],
});
const INTRO_BEFORE_SURVEY_STAGE = createInfoStage({
  id: 'sg_intro_before_survey',
  name: 'Before the survey',
  infoLines: [
    `# Congratulations on finishing the game phase!

You are about to enter the questionnaire phase.

It is divided into 3 parts with a total of 33 items, and will take approximately 6 minutes.

Click "Next stage" to continue.`,
  ],
});
// ****************************************************************************
// Comprehension check stage - 10 Questions
// ****************************************************************************

// --- Question 1: Role Assignment ---
const CQ1_ID = 'cq1';
const CQ1_A = createMultipleChoiceItem({
  text: 'Roles rotate randomly from one game to the next',
});
const CQ1_B = createMultipleChoiceItem({
  text: 'Roles are assigned at the beginning and remain the same across all games',
});
const CQ1_C = createMultipleChoiceItem({
  text: 'Roles change every round based on performance',
});

// --- Question 2: Decision Order ---
const CQ2_ID = 'cq2';
const CQ2_A = createMultipleChoiceItem({text: 'Advisor'});
const CQ2_B = createMultipleChoiceItem({text: 'Vendor'});
const CQ2_C = createMultipleChoiceItem({text: 'It depends on the day'});

// --- Question 3: Message Content ---
const CQ3_ID = 'cq3';
const CQ3_A = createMultipleChoiceItem({text: 'Yes'});
const CQ3_B = createMultipleChoiceItem({text: 'No'});
const CQ3_C = createMultipleChoiceItem({text: 'It depends on the day'});

// --- Question 4: Payoff Determination ---
const CQ4_ID = 'cq4';
const CQ4_A = createMultipleChoiceItem({text: 'The Advisor'});
const CQ4_B = createMultipleChoiceItem({text: 'The Vendor'});
const CQ4_C = createMultipleChoiceItem({text: 'The Advisor and the Vendor'});
const CQ4_D = createMultipleChoiceItem({text: 'The Default Protocol'});

// --- Question 5: High Payoff for Vendor ---
const CQ5_ID = 'cq5';
const CQ5_A = createMultipleChoiceItem({text: 'Alpha Market'});
const CQ5_B = createMultipleChoiceItem({
  text: 'Beta Market - Scenario 1: Quiet',
});
const CQ5_C = createMultipleChoiceItem({
  text: 'Beta Market - Scenario 2: Busy',
});

// --- Question 6: Advisor's Conflict ---
const CQ6_ID = 'cq6';
const CQ6_A = createMultipleChoiceItem({text: 'Alpha Market'});
const CQ6_B = createMultipleChoiceItem({text: 'Beta Market'});

const CQ6bis_ID = 'cq6bis';
const CQ6bis_A = createMultipleChoiceItem({text: 'Alpha Market'});
const CQ6bis_B = createMultipleChoiceItem({text: 'Beta Market'});

// --- Question 7: Information Asymmetry ---
const CQ7_ID = 'cq7';
const CQ7_A = createMultipleChoiceItem({
  text: 'Yes, both players see the true state of the Beta Market before choosing',
});
const CQ7_B = createMultipleChoiceItem({
  text: 'No, only the Advisor sees the true state of the Beta Market',
});

// --- Question 8: Timing & Timeout ---
const CQ8_ID = 'cq8';
const CQ8_A = createMultipleChoiceItem({
  text: 'The Advisor has unlimited time',
});
const CQ8_B = createMultipleChoiceItem({
  text: 'The Default Protocol sends a message, and the Advisor earns 0 points for that round',
});
const CQ8_C = createMultipleChoiceItem({
  text: 'The Default Protocol sends a message, but the Advisor still earns the normal payoff for that round',
});

// --- Question 9: Protocol Probabilities ---
const CQ9_ID = 'cq9';
const CQ9_A = createMultipleChoiceItem({
  text: 'Like a lottery, it has a probability of sending a message which is known to the Advisor.',
});
const CQ9_B = createMultipleChoiceItem({
  text: 'It sends the message "Busy" when Beta is busy, and "Quiet" when Beta is quiet.',
});
const CQ9_C = createMultipleChoiceItem({
  text: 'It copies the Advisor’s previous round decision',
});

// --- Question 10: Mode Payoff Differences ---
const CQ10_ID = 'cq10';
const CQ10_A = createMultipleChoiceItem({
  text: 'The Default Protocol chooses a market, and the Vendor earns 0 points for that round',
});
const CQ10_B = createMultipleChoiceItem({
  text: 'The Vendor has unlimited time',
});
const CQ10_C = createMultipleChoiceItem({
  text: 'The Default Protocol chooses a market, but the Vendor still earns the normal payoff for that round',
});

const COMPREHENSION_STAGE = createComprehensionStage({
  id: 'sg_comprehension',
  name: 'Comprehension Check',
  questions: [
    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ1_ID,
        questionTitle: 'How are the roles assigned in the games?',
        options: [CQ1_A, CQ1_B, CQ1_C],
      },
      CQ1_B.id,
    ),
    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ2_ID,
        questionTitle: 'During a single round, who makes the first move?',
        options: [CQ2_A, CQ2_B, CQ2_C],
      },
      CQ2_A.id,
    ),
    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ3_ID,
        questionTitle:
          'Is it mandatory for the Advisor to send a truthful message about the market conditions?',
        options: [CQ3_A, CQ3_B, CQ3_C],
      },
      CQ3_B.id,
    ),
    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ4_ID,
        questionTitle:
          'Whose final decision determines the earnings for both participants?',
        options: [CQ4_A, CQ4_B, CQ4_C, CQ4_D],
      },
      CQ4_B.id,
    ),
    // createMultipleChoiceComprehensionQuestion(
    //   {
    //     id: CQ5_ID,
    //     questionTitle:
    //       'Which market choice yields the highest possible payoff for the Vendor?',
    //     options: [CQ5_A, CQ5_B, CQ5_C],
    //   },
    //   CQ5_C.id,
    // ),
    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ6_ID,
        questionTitle:
          'If the Beta Market is busy, which choice gives the **Vendor** a higher payoff?',
        options: [CQ6_A, CQ6_B],
      },
      CQ6_B.id,
    ),

    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ6bis_ID,
        questionTitle:
          'If the Beta Market is busy, which choice gives the **Advisor** a higher payoff?',
        options: [CQ6bis_A, CQ6bis_B],
      },
      CQ6bis_A.id,
    ),

    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ7_ID,
        questionTitle:
          'Does the Vendor know the true state (busy vs. quiet) of the Beta Market before choosing?',
        options: [CQ7_A, CQ7_B],
      },
      CQ7_B.id,
    ),
    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ8_ID,
        questionTitle:
          'What happens if the **Advisor** takes no action for 15 seconds (timeout)?',
        options: [CQ8_A, CQ8_B, CQ8_C],
      },
      CQ8_B.id,
    ),
    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ9_ID,
        questionTitle:
          'What message does the Default Protocol send during a timeout?',
        options: [CQ9_A, CQ9_B, CQ9_C],
      },
      CQ9_A.id,
    ),
    createMultipleChoiceComprehensionQuestion(
      {
        id: CQ10_ID,
        questionTitle:
          'What happens if the **Vendor** does not act for 15 seconds (timeout)?',
        options: [CQ10_A, CQ10_B, CQ10_C],
      },
      CQ10_A.id,
    ),
  ],
});
// ****************************************************************************
// Shared SR config (payoff + truthfulness)
// ****************************************************************************

const SHARED_SR_CONFIG = {
  state1Probability: 0.5,
  numRounds: 15,
  enableTruthfulnessFeature: true,
  recommendationTextPrefix: ' ',
  senderTimeLimitInSeconds: 15,
  trueStatePrefix: 'Current state for',
  probabilityDisplayPrefix: '(Automatic-Message likelihood)',
  showPayoffFeedback: true,
  payoffSenderChoiceA: 30,
  payoffSenderChoiceB1: 0,
  payoffSenderChoiceB2: 20,
  payoffReceiverChoiceA: 20,
  payoffReceiverChoiceB1: 36,
  payoffReceiverChoiceB2: 4,
};

// ****************************************************************************
// SR Stages
// ****************************************************************************

/**
 * Generates the sender (Advisor) instruction text for a block, including
 * the auto-recommend probability for Beta vs Alpha market.
 *
 * @param probQuiet - truthfulnessOptions[0] for this block. This is the
 *   probability the system sends "Beta Market is quiet" (→ recommends Alpha).
 *   Probability of recommending Beta = 1 - probQuiet.
 * @param timeLimitSeconds - senderTimeLimitInSeconds from the shared config.
 */
function createSenderInstruction(
  probQuiet: number,
  timeLimitSeconds: number,
): string {
  const betaPercent = Math.round(probQuiet * 100);
  const alphaPercent = 100 - betaPercent;
  return `## You are an **Advisor**
The profitability of each market varies depending on customer flow, which only you will know in advance.

---

## ⚠️ Default Protocol — Auto-Recommend Probability

> You have **${timeLimitSeconds} seconds** to send your message. If you do not respond in time, the system automatically sends a message on your behalf:
>
>In the current game:
>
> There is a **${betaPercent}%** chance it says Beta Market **is quiet**.
>
> There is a **${alphaPercent}%** chance it says Alpha Market is **busy**`;
}

const TUTORIAL = createSenderReceiverStage({
  ...SHARED_SR_CONFIG,
  id: 'sg_tutorial',
  name: 'Tutorial Trials',
  numRounds: 4,
  senderTimeLimitInSeconds: 0,
  receiverTimeLimitInSeconds: 0,
  allowButtonPress: true,
  allowTextMessage: false,
  requireParticipantClick: false,
  senderSignalInstruction: '',
  state1Probability: 0.5,
  truthfulnessOptions: [0, 0.5, 1],
  attentionCheckRounds: [100],
});

const SG_Block1 = createSenderReceiverStage({
  ...SHARED_SR_CONFIG,
  id: 'sg_block1',
  name: 'Block 1',
  numRounds: 15,
  descriptions: createStageTextConfig({
    primaryText: 'Condition: button press enabled, auto-submit inhibited.',
  }),
  allowButtonPress: true,
  allowTextMessage: false,
  requireParticipantClick: true,
  truthfulnessOptions: [0], //tell:busy
  senderInstructionDetail: createSenderInstruction(
    0,
    SHARED_SR_CONFIG.senderTimeLimitInSeconds,
  ),
  senderSignalInstruction: '⚠️No message: 0 payoff',
  attentionCheckRounds: [100],
});

const SG_Block2 = createSenderReceiverStage({
  ...SHARED_SR_CONFIG,
  id: 'sg_block2',
  name: 'Block 2',
  numRounds: 15,
  descriptions: createStageTextConfig({
    primaryText: 'Condition: button press enabled, auto-submit allowed.',
  }),
  allowButtonPress: true,
  allowTextMessage: false,
  requireParticipantClick: true,
  truthfulnessOptions: [0.5], //50%:quiet, 50%:busy
  senderInstructionDetail: createSenderInstruction(
    0.5,
    SHARED_SR_CONFIG.senderTimeLimitInSeconds,
  ),
  senderSignalInstruction: '⚠️No message: 0 payoff',
  attentionCheckRounds: [8],
});

const SG_Block3 = createSenderReceiverStage({
  ...SHARED_SR_CONFIG,
  id: 'sg_block3',
  name: 'Block 3',
  numRounds: 15,
  descriptions: createStageTextConfig({
    primaryText: 'Condition: button press enabled, auto-submit inhibited.',
  }),
  allowButtonPress: true,
  allowTextMessage: false,
  requireParticipantClick: true,
  truthfulnessOptions: [1], //tell:quiet
  senderInstructionDetail: createSenderInstruction(
    1,
    SHARED_SR_CONFIG.senderTimeLimitInSeconds,
  ),
  senderSignalInstruction: '⚠️No message: 0 payoff',
  attentionCheckRounds: [100],
});

// ****************************************************************************
// Survey stage (post-game debrief – placeholder questions)
// ****************************************************************************
const DEMOGRAPHIC_SURVEY_STAGE = createSurveyStage({
  id: 'demographics',
  name: 'Demographic Information',
  questions: [
    // 1. Prolific ID (Essential for payment and linking data)
    createTextSurveyQuestion({
      questionTitle:
        'Please enter your Prolific ID(Usually a 24-character string of letters and numbers):',
    }),

    // 2. Age
    createScaleSurveyQuestion({
      questionTitle: 'What is your age?',
      lowerValue: 18,
      upperValue: 50,
      lowerText: '18',
      upperText: '60',
      useSlider: true,
    }),

    // 3. Gender
    createMultipleChoiceSurveyQuestion({
      questionTitle: 'What is your gender?',
      options: [
        createMultipleChoiceItem({text: 'Female'}),
        createMultipleChoiceItem({text: 'Male'}),
        createMultipleChoiceItem({text: 'Non-binary'}),
        createMultipleChoiceItem({text: 'Other'}),
        createMultipleChoiceItem({text: 'Prefer not to say'}),
      ],
    }),

    // 4. Native English Speaker
    createMultipleChoiceSurveyQuestion({
      questionTitle: 'Is English your native language?',
      options: [
        createMultipleChoiceItem({text: 'Yes'}),
        createMultipleChoiceItem({text: 'No'}),
      ],
    }),
    // 5. Country of Residence
    createTextSurveyQuestion({
      questionTitle: 'What is your country of residence?',
    }),

    // 6. Country of Birth
    createTextSurveyQuestion({
      questionTitle: 'What is your country of birth?',
    }),

    // 7. Education Level
    createMultipleChoiceSurveyQuestion({
      questionTitle:
        'What is the highest level of education you have completed?',
      options: [
        createMultipleChoiceItem({text: 'Less than high school'}),
        createMultipleChoiceItem({text: 'High school diploma or equivalent'}),
        createMultipleChoiceItem({text: 'Some college'}),
        createMultipleChoiceItem({text: "Bachelor's degree"}),
        createMultipleChoiceItem({text: 'Master degree'}),
        createMultipleChoiceItem({
          text: 'Professional degree (e.g., JD, MD, MBA)',
        }),
        createMultipleChoiceItem({text: 'Doctorate (PhD, EdD, etc.)'}),
        createMultipleChoiceItem({text: 'Other'}),
      ],
    }),

    // 8. Employment Status
    createMultipleChoiceSurveyQuestion({
      questionTitle: 'What is your current employment status?',
      options: [
        createMultipleChoiceItem({text: 'Employed full-time'}),
        createMultipleChoiceItem({text: 'Employed part-time'}),
        createMultipleChoiceItem({text: 'Student'}),
        createMultipleChoiceItem({text: 'Unemployed'}),
        createMultipleChoiceItem({text: 'Retired'}),
        createMultipleChoiceItem({text: 'Other'}),
      ],
    }),
  ],

  descriptions: createStageTextConfig({
    primaryText:
      'Please click "Next stage" after completing all questions to proceed.',
  }),
});

const ROLE_SURVEY_STAGE = createSurveyStage({
  id: 'sg_role_survey',
  name: 'Your Role',
  questions: [
    createMultipleChoiceSurveyQuestion({
      questionTitle: 'What was your role in the previous game?',
      options: [
        createMultipleChoiceItem({id: 'sender_choice', text: 'Advisor'}),
        createMultipleChoiceItem({id: 'receiver_choice', text: 'Vendor'}),
      ],
    }),
  ],
});
const SURVEY_STAGE1 = createSurveyStage({
  id: 'lit_survey_1',
  name: 'Questionnaire Part 1/3',
  descriptions: createStageTextConfig({}),
  questions: [
    createScaleSurveyQuestion({
      questionTitle:
        '### Please estimate the behavior of players in general.\n\nOut of 100 advisors in one day, how many do you think send "Beta is busy" while in reality Beta is quiet? ',
      lowerValue: 0,
      upperValue: 100,
      lowerText: '0% (No one)',
      upperText: '100% (Everyone) ',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        'Out of 15 days, how often do you think advisors send "Beta is quiet" while in reality Beta is busy? ',
      lowerValue: 0,
      upperValue: 100,
      lowerText: '0% (Never)',
      upperText: '100% (Every day) ',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        "Out of 100 vendors in one day, how many do you think trust their advisors' message?",
      lowerValue: 0,
      upperValue: 100,
      lowerText: '0% (No one)',
      upperText: '100% (Everyone)',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        "Out of 15 days, how often do you think vendors trust their advisors' message?",
      lowerValue: 0,
      upperValue: 100,
      lowerText: '0% (Never)',
      upperText: '100% (Every day) ',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        '### Now, please evaluate the behaviors that occurred during the game.\n\nHow moral were the advisors’ behaviors? If you were the advisor, answer for yourself.',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Completely Immoral',
      middleText: 'Neither Moral nor Immoral',
      upperText: 'Completely Moral',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        'To what extent de advisors’ behaviors were intended to help the vendor? If you were the advisor, answer for yourself.',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Not at all',
      upperText: 'Completely',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        'When the advisor was being deshonest, to what extent do you think this was intentional? If you were the advisor, answer for yourself.',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Not at all',
      upperText: 'Completely',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        'To what extent do you think players did regret their behavior?',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Not at all',
      upperText: 'Completely',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        'To what extent did you understand that your behavior was affecting the other player??',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Not at all',
      upperText: 'Completely',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        'To what extent do you think other players were thinking about what you were thinking during the games?',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Not at all',
      upperText: 'Completely',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        '### Now, please tell us about your personal experience. \n\n How motivated were you while playing the game?',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Not at all',
      upperText: 'Completely',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle: 'How well did you understand the game?',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Not at all',
      upperText: 'Completely',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        'Please answer 75 to this slider question. This is an attention check question.',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Not at all',
      upperText: 'Completely',
      useSlider: true,
    }),

    createScaleSurveyQuestion({
      questionTitle:
        'To what extent were you thinking about what the other player was thinking during the games?',
      lowerValue: 0,
      upperValue: 100,
      lowerText: 'Not at all',
      upperText: 'Completely',
      useSlider: true,
    }),
  ],
});
const SURVEY_STAGE2 = createSurveyStage({
  id: 'lit_survey_2',
  name: 'Questionnaire Part 3/3',
  descriptions: createStageTextConfig({}),
  questions: [
    createMultipleChoiceSurveyQuestion({
      questionTitle:
        '### Imagine you have the power to distribute a monetary reward between yourself and another randomly selected, anonymous participant. For each scenario, please indicate which distribution you prefer.\n \n Choice #1:',
      options: [
        createMultipleChoiceItem({
          text: 'I receive $2 and the other receives $2',
        }),
        createMultipleChoiceItem({
          text: 'I receive $2 and the other receives $1',
        }),
      ],
    }),

    createMultipleChoiceSurveyQuestion({
      questionTitle: 'Choice #2:',
      options: [
        createMultipleChoiceItem({
          text: 'I receive $2 and the other receives $2',
        }),
        createMultipleChoiceItem({
          text: 'I receive $3 and the other receives $1',
        }),
      ],
    }),

    createMultipleChoiceSurveyQuestion({
      questionTitle: 'Choice #3:',
      options: [
        createMultipleChoiceItem({
          text: 'I receive $2 and the other receives $2',
        }),
        createMultipleChoiceItem({
          text: 'I receive $2 and the other receives $4',
        }),
      ],
    }),

    createMultipleChoiceSurveyQuestion({
      questionTitle: 'Choice #4:',
      options: [
        createMultipleChoiceItem({
          text: 'I receive $2 and the other receives $2',
        }),
        createMultipleChoiceItem({
          text: 'I receive $3 and the other receives $5',
        }),
      ],
    }),
  ],
});

const SURVEY_STAGE3 = createSurveyStage({
  id: 'lit_survey_3',
  name: 'Questionnaire Part 2/3',
  questions: [
    createScaleSurveyQuestion({
      id: 'alloc_q1',
      questionTitle:
        '### Please complete the 15 resource allocation items below.\n\nSelect your preferred distribution of earnings between yourself and one other participant. The other player is an anonymous participant who signed up for this study.\n\n### Bonus payment rule\n\nOne of these 5 chosen allocations will be randomly selected and added to your bonus payoff.\n\nConversion rate: 10 points = £0.04.\n\n### Item 1:',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You 85', bottom: 'Other 85'},
        {top: 'You 85', bottom: 'Other 76'},
        {top: 'You 85', bottom: 'Other 68'},
        {top: 'You 85', bottom: 'Other 59'},
        {top: 'You 85', bottom: 'Other 50'},
        {top: 'You 85', bottom: 'Other 41'},
        {top: 'You 85', bottom: 'Other 33'},
        {top: 'You 85', bottom: 'Other 24'},
        {top: 'You 85', bottom: 'Other 15'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q2',
      questionTitle: '### Item 2:',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  85', bottom: 'Other 15'},
        {top: 'You  87', bottom: 'Other 19'},
        {top: 'You  89', bottom: 'Other 24'},
        {top: 'You  91', bottom: 'Other 28'},
        {top: 'You  93', bottom: 'Other 33'},
        {top: 'You  94', bottom: 'Other 37'},
        {top: 'You  96', bottom: 'Other 41'},
        {top: 'You  98', bottom: 'Other 46'},
        {top: 'You  100', bottom: 'Other 50'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q3',
      questionTitle: '### Item 3',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  50', bottom: 'Other  100'},
        {top: 'You  54', bottom: 'Other  98'},
        {top: 'You  59', bottom: 'Other  96'},
        {top: 'You  63', bottom: 'Other  94'},
        {top: 'You  68', bottom: 'Other  93'},
        {top: 'You  72', bottom: 'Other  91'},
        {top: 'You  76', bottom: 'Other  89'},
        {top: 'You  81', bottom: 'Other  87'},
        {top: 'You  85', bottom: 'Other  85'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q4',
      questionTitle: '### Item 4',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  50', bottom: 'Other  100'},
        {top: 'You  54', bottom: 'Other  89'},
        {top: 'You  59', bottom: 'Other  79'},
        {top: 'You  63', bottom: 'Other  68'},
        {top: 'You  68', bottom: 'Other  58'},
        {top: 'You  72', bottom: 'Other  47'},
        {top: 'You  76', bottom: 'Other  36'},
        {top: 'You  81', bottom: 'Other  26'},
        {top: 'You  85', bottom: 'Other  15'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q5',
      questionTitle: '### Item 5',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  100', bottom: 'Other  50'},
        {top: 'You  94', bottom: 'Other  56'},
        {top: 'You  88', bottom: 'Other  63'},
        {top: 'You  81', bottom: 'Other  69'},
        {top: 'You  75', bottom: 'Other  75'},
        {top: 'You  69', bottom: 'Other  81'},
        {top: 'You  63', bottom: 'Other  88'},
        {top: 'You  56', bottom: 'Other  94'},
        {top: 'You  50', bottom: 'Other  100'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q6',
      questionTitle: '### Item 6',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  100', bottom: 'Other  50'},
        {top: 'You  98', bottom: 'Other  54'},
        {top: 'You  96', bottom: 'Other  59'},
        {top: 'You  94', bottom: 'Other  63'},
        {top: 'You  93', bottom: 'Other  68'},
        {top: 'You  91', bottom: 'Other  72'},
        {top: 'You  89', bottom: 'Other  76'},
        {top: 'You  87', bottom: 'Other  81'},
        {top: 'You  85', bottom: 'Other  85'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q7',
      questionTitle: '### Item 7',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  100', bottom: 'Other  50'},
        {top: 'You  96', bottom: 'Other  56'},
        {top: 'You  93', bottom: 'Other  63'},
        {top: 'You  89', bottom: 'Other  69'},
        {top: 'You  85', bottom: 'Other  75'},
        {top: 'You  81', bottom: 'Other  81'},
        {top: 'You  78', bottom: 'Other  88'},
        {top: 'You  74', bottom: 'Other  94'},
        {top: 'You  70', bottom: 'Other  100'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q8',
      questionTitle: '### Item 8',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  90', bottom: 'Other  100'},
        {top: 'You  91', bottom: 'Other  99'},
        {top: 'You  93', bottom: 'Other  98'},
        {top: 'You  94', bottom: 'Other  96'},
        {top: 'You  95', bottom: 'Other  95'},
        {top: 'You  96', bottom: 'Other  94'},
        {top: 'You  98', bottom: 'Other  93'},
        {top: 'You  99', bottom: 'Other  91'},
        {top: 'You  100', bottom: 'Other  90'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q9',
      questionTitle: '### Item 9',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  100', bottom: 'Other  70'},
        {top: 'You  94', bottom: 'Other  74'},
        {top: 'You  88', bottom: 'Other  78'},
        {top: 'You  81', bottom: 'Other  81'},
        {top: 'You  75', bottom: 'Other  85'},
        {top: 'You  69', bottom: 'Other  89'},
        {top: 'You  63', bottom: 'Other  93'},
        {top: 'You  56', bottom: 'Other  96'},
        {top: 'You  50', bottom: 'Other  100'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q10',
      questionTitle: '### Item 10',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  100', bottom: 'Other  70'},
        {top: 'You  99', bottom: 'Other  74'},
        {top: 'You  98', bottom: 'Other  78'},
        {top: 'You  96', bottom: 'Other  81'},
        {top: 'You  95', bottom: 'Other  85'},
        {top: 'You  94', bottom: 'Other  89'},
        {top: 'You  93', bottom: 'Other  93'},
        {top: 'You  91', bottom: 'Other  96'},
        {top: 'You  90', bottom: 'Other  100'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q11',
      questionTitle: '### Item 11',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  70', bottom: 'Other  100'},
        {top: 'You  74', bottom: 'Other  96'},
        {top: 'You  78', bottom: 'Other  93'},
        {top: 'You  81', bottom: 'Other  89'},
        {top: 'You  85', bottom: 'Other  85'},
        {top: 'You  89', bottom: 'Other  81'},
        {top: 'You  93', bottom: 'Other  78'},
        {top: 'You  96', bottom: 'Other  74'},
        {top: 'You  100', bottom: 'Other  70'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q12',
      questionTitle: '### Item 12',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  50', bottom: 'Other  100'},
        {top: 'You  56', bottom: 'Other  99'},
        {top: 'You  63', bottom: 'Other  98'},
        {top: 'You  69', bottom: 'Other  96'},
        {top: 'You  75', bottom: 'Other  95'},
        {top: 'You  81', bottom: 'Other  94'},
        {top: 'You  88', bottom: 'Other  93'},
        {top: 'You  94', bottom: 'Other  91'},
        {top: 'You  100', bottom: 'Other  90'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q13',
      questionTitle: '### Item 13',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  50', bottom: 'Other  100'},
        {top: 'You  56', bottom: 'Other  94'},
        {top: 'You  63', bottom: 'Other  88'},
        {top: 'You  69', bottom: 'Other  81'},
        {top: 'You  75', bottom: 'Other  75'},
        {top: 'You  81', bottom: 'Other  69'},
        {top: 'You  88', bottom: 'Other  63'},
        {top: 'You  94', bottom: 'Other  56'},
        {top: 'You  100', bottom: 'Other  50'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q14',
      questionTitle: '### Item 14',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  100', bottom: 'Other  90'},
        {top: 'You  96', bottom: 'Other  91'},
        {top: 'You  93', bottom: 'Other  93'},
        {top: 'You  89', bottom: 'Other  94'},
        {top: 'You  85', bottom: 'Other  95'},
        {top: 'You  81', bottom: 'Other  96'},
        {top: 'You  78', bottom: 'Other  98'},
        {top: 'You  74', bottom: 'Other  99'},
        {top: 'You  70', bottom: 'Other  100'},
      ],
      useSlider: false,
    }),

    createScaleSurveyQuestion({
      id: 'alloc_q15',
      questionTitle: '### Item 15',
      lowerValue: 1,
      upperValue: 9,
      optionLabels: [
        {top: 'You  90', bottom: 'Other  100'},
        {top: 'You  91', bottom: 'Other  94'},
        {top: 'You  93', bottom: 'Other  88'},
        {top: 'You  94', bottom: 'Other  81'},
        {top: 'You  95', bottom: 'Other  75'},
        {top: 'You  96', bottom: 'Other  69'},
        {top: 'You  98', bottom: 'Other  63'},
        {top: 'You  99', bottom: 'Other  56'},
        {top: 'You  100', bottom: 'Other  50'},
      ],
      useSlider: false,
    }),
  ],
});
/**
 * Final Payout Stage configuration.
 * This stage aggregates results from all experimental conditions defined previously.
 */
const PAYOUT_STAGE = createPayoutStage({
  id: 'sg_final_payout',
  name: 'Total Bonus Summary',
  descriptions: createStageTextConfig({
    primaryText:
      'Thank you for participating! Below is the breakdown of your earnings based on your performance in each game condition.',
  }),
  currency: PayoutCurrency.EUR, // Set to your preferred currency (EUR, USD, GBP)
  averageAllPayoutItems: false, // Set to true if you want the average instead of the sum

  payoutItems: [
    // 1. Condition: Button press with no click requirement
    // Conversion rate: £6 bonus max / 1450 max points ≈ £0.00414 per point
    // (base pay £6/hr, max £12/hr for a ~1 hour session)
    createSenderReceiverPayoutItem({
      name: 'BLOCK1',
      description: ' ',
      stageId: 'sg_block1',
      currencyPerPoint: 0.00414,
    }),

    createSenderReceiverPayoutItem({
      name: 'BLOCK2',
      description: ' ',
      stageId: 'sg_block2',
      currencyPerPoint: 0.00414,
    }),

    createSenderReceiverPayoutItem({
      name: 'BLOCK3',
      description: ' ',
      stageId: 'sg_block3',
      currencyPerPoint: 0.00414,
    }),

    // Note: The TUTORIAL stage is excluded as it typically does not involve real payoffs.

    // Questionnaire bonus: one of the 15 allocation items is randomly selected.
    ...(
      [
        {id: 'alloc_q1', youValues: [85, 85, 85, 85, 85, 85, 85, 85, 85]},
        {id: 'alloc_q2', youValues: [85, 87, 89, 91, 93, 94, 96, 98, 100]},
        {id: 'alloc_q3', youValues: [50, 54, 59, 63, 68, 72, 76, 81, 85]},
        {id: 'alloc_q4', youValues: [50, 54, 59, 63, 68, 72, 76, 81, 85]},
        {id: 'alloc_q5', youValues: [100, 94, 88, 81, 75, 69, 63, 56, 50]},
        {id: 'alloc_q6', youValues: [100, 98, 96, 94, 93, 91, 89, 87, 85]},
        {id: 'alloc_q7', youValues: [100, 96, 93, 89, 85, 81, 78, 74, 70]},
        {id: 'alloc_q8', youValues: [90, 91, 93, 94, 95, 96, 98, 99, 100]},
        {id: 'alloc_q9', youValues: [100, 94, 88, 81, 75, 69, 63, 56, 50]},
        {id: 'alloc_q10', youValues: [100, 99, 98, 96, 95, 94, 93, 91, 90]},
        {id: 'alloc_q11', youValues: [70, 74, 78, 81, 85, 89, 93, 96, 100]},
        {id: 'alloc_q12', youValues: [50, 56, 63, 69, 75, 81, 88, 94, 100]},
        {id: 'alloc_q13', youValues: [50, 56, 63, 69, 75, 81, 88, 94, 100]},
        {id: 'alloc_q14', youValues: [100, 96, 93, 89, 85, 81, 78, 74, 70]},
        {id: 'alloc_q15', youValues: [90, 91, 93, 94, 95, 96, 98, 99, 100]},
      ] as {id: string; youValues: number[]}[]
    ).map((q) =>
      createScaleSurveyPayoutItem({
        name: 'Questionnaire Bonus',
        description:
          'Bonus from a randomly selected allocation question in the questionnaire.',
        stageId: 'lit_survey_3',
        questionId: q.id,
        youValues: q.youValues,
        currencyPerPoint: 0.00414,
        randomSelectionId: 'allocation_task',
      }),
    ),
  ],
});

const COMMUNICATION_STAGE = createSurveyStage({
  id: 'sg_communication',
  name: 'Comments & Feedback',
  descriptions: createStageTextConfig({
    primaryText:
      'This field is optional. Feel free to share any comments or remarks about your experience in this study.',
  }),
  questions: [
    createTextSurveyQuestion({
      questionTitle:
        'Do you have any comments, remarks, or anything you would like to communicate to us about the experiment?',
      isOptional: true,
    }),
  ],
});
