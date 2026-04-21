function shiftDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createSeedBlock(id, type, name, content, styles) {
  return { id, type, name, content, styles };
}

function createSeedDesign(blocks, canvas = {}) {
  return {
    canvas: {
      bodyBackground: "#1c211d",
      emailBackground: "#ffffff",
      width: 680,
      radius: 0,
      fontFamily: "Arial, sans-serif",
      ...canvas
    },
    blocks
  };
}

export const seedCompanies = [
  {
    id: "c1c58a26-a3e0-4e7c-b3a6-7a92bc1f1001",
    companyName: "Orion Data Systems",
    contactName: "James Patel",
    contactRole: "Head of Partnerships",
    contactEmail: "james@oriondata.example",
    sector: "Telemetry & Analytics",
    status: "secured",
    askType: "software",
    askValue: 18000,
    contributionValue: 15000,
    contributionType: "Telemetry platform and cash support",
    firstContacted: shiftDate(-42),
    nextFollowUp: shiftDate(5),
    proposalDate: shiftDate(-12),
    interviewDate: shiftDate(-25),
    responseStatus: "won",
    requestFromUs: "Case-study content, logo placement, race updates",
    givingInReturn: "Annual licence, engineering mentorship, cash support",
    notes: "Strong strategic fit and open to expanding support mid-season."
  },
  {
    id: "c1c58a26-a3e0-4e7c-b3a6-7a92bc1f1002",
    companyName: "Apex Composite Works",
    contactName: "Ella Morgan",
    contactRole: "Commercial Director",
    contactEmail: "ella@apexcomposites.example",
    sector: "Composite Manufacturing",
    status: "proposal",
    askType: "materials",
    askValue: 12000,
    contributionValue: 5000,
    contributionType: "Discounted carbon fibre stock",
    firstContacted: shiftDate(-28),
    nextFollowUp: shiftDate(3),
    proposalDate: shiftDate(8),
    interviewDate: "",
    responseStatus: "interested",
    requestFromUs: "Garage branding and a technical workshop visit",
    givingInReturn: "Materials package, discounted tooling, advisor support",
    notes: "Proposal requested with a strong focus on student outreach."
  },
  {
    id: "c1c58a26-a3e0-4e7c-b3a6-7a92bc1f1003",
    companyName: "Helix Motion Media",
    contactName: "Sofia Bennett",
    contactRole: "Brand Partnerships Lead",
    contactEmail: "sofia@helixmotion.example",
    sector: "Media & Content",
    status: "negotiating",
    askType: "media",
    askValue: 9000,
    contributionValue: 2500,
    contributionType: "Video production support",
    firstContacted: shiftDate(-21),
    nextFollowUp: shiftDate(1),
    proposalDate: shiftDate(6),
    interviewDate: shiftDate(4),
    responseStatus: "interview",
    requestFromUs: "Driver access, sponsor-led media day, short-form reels",
    givingInReturn: "Launch video, photo package, race-day edits",
    notes: "Interview booked. Wants cleaner rights language in the proposal."
  },
  {
    id: "c1c58a26-a3e0-4e7c-b3a6-7a92bc1f1004",
    companyName: "Torque Precision",
    contactName: "Marcus Reed",
    contactRole: "Operations Manager",
    contactEmail: "marcus@torqueprecision.example",
    sector: "Precision Engineering",
    status: "warm",
    askType: "machining",
    askValue: 8000,
    contributionValue: 0,
    contributionType: "",
    firstContacted: shiftDate(-18),
    nextFollowUp: shiftDate(2),
    proposalDate: "",
    interviewDate: shiftDate(10),
    responseStatus: "requested_info",
    requestFromUs: "Technical spec sheet and machining scope by subsystem",
    givingInReturn: "Potential CNC time and tooling discounts",
    notes: "Needs a tighter component list before committing capacity."
  },
  {
    id: "c1c58a26-a3e0-4e7c-b3a6-7a92bc1f1005",
    companyName: "Northstar Logistics",
    contactName: "Priya Singh",
    contactRole: "Business Development Executive",
    contactEmail: "priya@northstarlogistics.example",
    sector: "Transport & Logistics",
    status: "prospect",
    askType: "travel",
    askValue: 6500,
    contributionValue: 0,
    contributionType: "",
    firstContacted: shiftDate(-8),
    nextFollowUp: shiftDate(-1),
    proposalDate: shiftDate(11),
    interviewDate: "",
    responseStatus: "waiting",
    requestFromUs: "Travel calendar, event list, and vehicle movement estimate",
    givingInReturn: "Potential freight support and discounted transport",
    notes: "Overdue follow-up after initial positive discovery call."
  }
];

export const seedTemplates = [
  {
    id: "4b4108e7-5874-4c42-aab3-9c10d11c2001",
    name: "Warm Introduction",
    category: "Outreach",
    subject: "{{team_name}} x {{company_name}} partnership opportunity",
    design: createSeedDesign([
      createSeedBlock(
        "seed-intro-logo",
        "image",
        "Logo",
        { src: "./assets/atomic-logo-green.jpeg", alt: "Atomic" },
        { align: "left", width: 118, paddingTop: 26, paddingBottom: 18, paddingX: 28 }
      ),
      createSeedBlock(
        "seed-intro-kicker",
        "paragraph",
        "Eyebrow",
        { text: "PARTNERSHIP OPPORTUNITY" },
        {
          align: "center",
          color: "#1a211a",
          fontSize: 13,
          fontWeight: 700,
          paddingTop: 6,
          paddingBottom: 12,
          paddingX: 40
        }
      ),
      createSeedBlock(
        "seed-intro-heading",
        "heading",
        "Headline",
        { text: "{{team_name}} x {{company_name}}" },
        {
          align: "center",
          color: "#111111",
          fontSize: 42,
          fontWeight: 700,
          paddingTop: 0,
          paddingBottom: 18,
          paddingX: 40
        }
      ),
      createSeedBlock(
        "seed-intro-body-1",
        "paragraph",
        "Intro Copy",
        {
          text: "Hi {{contact_first_name}},\n\nI am reaching out from {{team_name}} as we prepare for {{season_label}}. We think {{company_name}} could be a brilliant fit for a partnership that blends engineering visibility, student talent, and performance."
        },
        {
          align: "left",
          color: "#425066",
          fontSize: 16,
          lineHeight: 1.7,
          paddingTop: 0,
          paddingBottom: 18,
          paddingX: 40
        }
      ),
      createSeedBlock(
        "seed-intro-body-2",
        "paragraph",
        "Ask Copy",
        {
          text: "We are currently looking for support around {{ask_type}} with a target package value of {{ask_value}}."
        },
        {
          align: "left",
          color: "#425066",
          fontSize: 16,
          lineHeight: 1.7,
          paddingTop: 0,
          paddingBottom: 18,
          paddingX: 40
        }
      ),
      createSeedBlock(
        "seed-intro-button",
        "button",
        "Button",
        { label: "Visit Team Site", url: "{{team_website}}" },
        {
          align: "center",
          backgroundColor: "#32ce32",
          color: "#041004",
          radius: 999,
          fontSize: 15,
          fontWeight: 700,
          paddingTop: 14,
          paddingBottom: 14,
          paddingX: 24,
          outerPaddingTop: 8,
          outerPaddingBottom: 24
        }
      ),
      createSeedBlock(
        "seed-intro-signoff",
        "paragraph",
        "Sign-Off",
        { text: "Best,\n{{team_signature}}" },
        {
          align: "left",
          color: "#425066",
          fontSize: 15,
          lineHeight: 1.7,
          paddingTop: 0,
          paddingBottom: 28,
          paddingX: 40
        }
      )
    ]),
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; background:#f5f7fb; padding:24px;">
  <tr>
    <td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:20px; overflow:hidden;">
        <tr>
          <td style="background:#0b1423; color:#ffffff; padding:28px 32px;">
            <div style="font-size:13px; letter-spacing:0.18em; text-transform:uppercase; color:#ffb36b;">{{team_name}}</div>
            <h1 style="margin:12px 0 0; font-size:28px; line-height:1.1;">Partnership Opportunity</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 18px; color:#182230; font-size:16px;">Hi {{contact_first_name}},</p>
            <p style="margin:0 0 18px; color:#425066; font-size:16px; line-height:1.7;">I am reaching out from {{team_name}} as we prepare for {{season_label}}. We think {{company_name}} could be a brilliant fit for a partnership that blends performance, engineering visibility, and student talent development.</p>
            <p style="margin:0 0 18px; color:#425066; font-size:16px; line-height:1.7;">We are currently looking for support around <strong>{{ask_type}}</strong>, with a target package value of <strong>{{ask_value}}</strong>.</p>
            <p style="margin:0 0 18px; color:#425066; font-size:16px; line-height:1.7;">In return, we can offer brand visibility, technical storytelling, on-car placement, social media features, and a collaborative activation plan shaped around your priorities.</p>
            <p style="margin:0; color:#425066; font-size:16px; line-height:1.7;">If this is of interest, I would love to send over a short proposal and arrange a quick call.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px; color:#425066; font-size:15px;">
            <strong>{{team_signature}}</strong><br />
            <a href="{{team_website}}" style="color:#ff5b3d; text-decoration:none;">{{team_website}}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },
  {
    id: "4b4108e7-5874-4c42-aab3-9c10d11c2002",
    name: "Follow-Up After First Contact",
    category: "Follow-Up",
    subject: "Following up from {{team_name}}",
    design: createSeedDesign([
      createSeedBlock(
        "seed-follow-logo",
        "image",
        "Logo",
        { src: "./assets/atomic-logo-green.jpeg", alt: "Atomic" },
        { align: "left", width: 118, paddingTop: 26, paddingBottom: 18, paddingX: 28 }
      ),
      createSeedBlock(
        "seed-follow-heading",
        "heading",
        "Headline",
        { text: "Following up from {{team_name}}" },
        {
          align: "center",
          color: "#111111",
          fontSize: 40,
          fontWeight: 700,
          paddingTop: 12,
          paddingBottom: 18,
          paddingX: 40
        }
      ),
      createSeedBlock(
        "seed-follow-body-1",
        "paragraph",
        "Body",
        {
          text: "Hi {{contact_first_name}},\n\nI wanted to follow up on my previous message about a potential partnership between {{team_name}} and {{company_name}}."
        },
        {
          align: "left",
          color: "#425066",
          fontSize: 16,
          lineHeight: 1.7,
          paddingTop: 0,
          paddingBottom: 18,
          paddingX: 40
        }
      ),
      createSeedBlock(
        "seed-follow-body-2",
        "paragraph",
        "Details",
        {
          text: "We are currently shaping a package around {{ask_type}} and would be happy to tailor the proposal so it aligns with what matters most to your team.\n\nIf helpful, I can send over our sponsor deck and suggested plan ahead of {{next_follow_up}}."
        },
        {
          align: "left",
          color: "#425066",
          fontSize: 16,
          lineHeight: 1.7,
          paddingTop: 0,
          paddingBottom: 22,
          paddingX: 40
        }
      ),
      createSeedBlock(
        "seed-follow-signoff",
        "paragraph",
        "Sign-Off",
        { text: "Best,\n{{team_signature}}" },
        {
          align: "left",
          color: "#425066",
          fontSize: 15,
          lineHeight: 1.7,
          paddingTop: 0,
          paddingBottom: 28,
          paddingX: 40
        }
      )
    ]),
    html: `<div style="font-family: Arial, sans-serif; background:#ffffff; color:#182230; max-width:640px; margin:0 auto; padding:32px; border:1px solid #e8edf5; border-radius:20px;">
  <p style="font-size:16px; line-height:1.7;">Hi {{contact_first_name}},</p>
  <p style="font-size:16px; line-height:1.7;">I wanted to follow up on my previous message about a potential partnership between {{team_name}} and {{company_name}}.</p>
  <p style="font-size:16px; line-height:1.7;">We are currently shaping a package around <strong>{{ask_type}}</strong> and would be happy to tailor the proposal so it aligns with what matters most to your team.</p>
  <p style="font-size:16px; line-height:1.7;">If helpful, I can send over our sponsor deck, expected deliverables, and a suggested plan ahead of {{next_follow_up}}.</p>
  <p style="font-size:16px; line-height:1.7;">Best,<br /><strong>{{team_signature}}</strong></p>
</div>`
  },
  {
    id: "4b4108e7-5874-4c42-aab3-9c10d11c2003",
    name: "Proposal Recap",
    category: "Proposal",
    subject: "{{team_name}} proposal recap for {{company_name}}",
    design: createSeedDesign(
      [
        createSeedBlock(
          "seed-proposal-logo",
          "image",
          "Logo",
          { src: "./assets/atomic-logo-green.jpeg", alt: "Atomic" },
          { align: "left", width: 118, paddingTop: 26, paddingBottom: 18, paddingX: 28 }
        ),
        createSeedBlock(
          "seed-proposal-kicker",
          "paragraph",
          "Eyebrow",
          { text: "PROPOSAL RECAP" },
          {
            align: "center",
            color: "#d8ffd2",
            fontSize: 13,
            fontWeight: 700,
            paddingTop: 6,
            paddingBottom: 12,
            paddingX: 40,
            backgroundColor: "#0c1320"
          }
        ),
        createSeedBlock(
          "seed-proposal-heading",
          "heading",
          "Headline",
          { text: "{{company_name}} x {{team_name}}" },
          {
            align: "center",
            color: "#f6f8fc",
            fontSize: 38,
            fontWeight: 700,
            paddingTop: 0,
            paddingBottom: 18,
            paddingX: 40,
            backgroundColor: "#0c1320"
          }
        ),
        createSeedBlock(
          "seed-proposal-body-1",
          "paragraph",
          "Summary",
          {
            text: "Hi {{contact_first_name}}, thank you again for the conversation.\n\nAs discussed, our proposed package is centred on {{ask_type}} with an indicative value of {{ask_value}}."
          },
          {
            align: "left",
            color: "#f6f8fc",
            fontSize: 16,
            lineHeight: 1.7,
            paddingTop: 0,
            paddingBottom: 16,
            paddingX: 40,
            backgroundColor: "#0c1320"
          }
        ),
        createSeedBlock(
          "seed-proposal-body-2",
          "paragraph",
          "Requirements",
          {
            text: "From your side, we have noted the following focus areas: {{request_from_us}}.\n\nWe have logged the next internal milestone for {{proposal_date}} and can refine the deliverables further before then."
          },
          {
            align: "left",
            color: "#f6f8fc",
            fontSize: 16,
            lineHeight: 1.7,
            paddingTop: 0,
            paddingBottom: 26,
            paddingX: 40,
            backgroundColor: "#0c1320"
          }
        )
      ],
      {
        bodyBackground: "#0c1320",
        emailBackground: "#0c1320"
      }
    ),
    html: `<div style="font-family: Arial, sans-serif; background:#0c1320; color:#f6f8fc; max-width:680px; margin:0 auto; padding:36px; border-radius:24px;">
  <p style="margin:0 0 18px; color:#ffcc84; text-transform:uppercase; letter-spacing:0.2em; font-size:12px;">Proposal Recap</p>
  <h2 style="margin:0 0 18px; font-size:30px;">{{company_name}} x {{team_name}}</h2>
  <p style="margin:0 0 16px; font-size:16px; line-height:1.7;">Hi {{contact_first_name}}, thank you again for the conversation.</p>
  <p style="margin:0 0 16px; font-size:16px; line-height:1.7;">As discussed, our proposed package is centred on <strong>{{ask_type}}</strong> with an indicative value of <strong>{{ask_value}}</strong>.</p>
  <p style="margin:0 0 16px; font-size:16px; line-height:1.7;">From your side, we have noted the following focus areas: <strong>{{request_from_us}}</strong>.</p>
  <p style="margin:0 0 16px; font-size:16px; line-height:1.7;">We have logged the next internal milestone for <strong>{{proposal_date}}</strong> and can refine the deliverables further before then.</p>
  <p style="margin:0; font-size:16px; line-height:1.7;">Best regards,<br /><strong>{{team_signature}}</strong></p>
</div>`
  }
];
