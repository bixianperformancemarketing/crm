require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const {
  sequelize, Plan, Organization, Workspace, User,
  Lead, LeadActivity, Followup, Quotation, QuotationItem,
  Invoice, Payment, ContentTask, Notification, syncDatabase,
} = require('./models');

const seed = async () => {
  try {
    await syncDatabase();
    console.log('\n🌱 Starting database seed...\n');

    // ─── PLANS ────────────────────────────────────────────────────────────
    const plans = [
      {
        name: 'trial',
        displayName: 'Free Trial',
        price: 0,
        maxWorkspaces: 1,
        maxUsersPerWorkspace: 3,
        maxLeadsTotal: 100,
        canUseWebhooks: false,
        canUsePDF: false,
        canUseCSVImport: false,
        canUseContentCalendar: false,
        canUseAdvancedReports: false,
        description: '14-day free trial with basic features',
        durationDays: 14,
      },
      {
        name: 'starter',
        displayName: 'Starter',
        price: 2999,
        maxWorkspaces: 2,
        maxUsersPerWorkspace: 5,
        maxLeadsTotal: 1000,
        canUseWebhooks: false,
        canUsePDF: true,
        canUseCSVImport: true,
        canUseContentCalendar: false,
        canUseAdvancedReports: false,
        description: 'Perfect for small agencies getting started',
        durationDays: 30,
      },
      {
        name: 'growth',
        displayName: 'Growth',
        price: 5999,
        maxWorkspaces: 5,
        maxUsersPerWorkspace: 15,
        maxLeadsTotal: 10000,
        canUseWebhooks: true,
        canUsePDF: true,
        canUseCSVImport: true,
        canUseContentCalendar: true,
        canUseAdvancedReports: true,
        description: 'For growing companies managing multiple projects',
        durationDays: 30,
      },
      {
        name: 'agency',
        displayName: 'Enterprise',
        price: 11999,
        maxWorkspaces: 999,
        maxUsersPerWorkspace: 999,
        maxLeadsTotal: 999999,
        canUseWebhooks: true,
        canUsePDF: true,
        canUseCSVImport: true,
        canUseContentCalendar: true,
        canUseAdvancedReports: true,
        description: 'Unlimited everything for large agencies',
        durationDays: 30,
      },
    ];

    for (const planData of plans) {
      await Plan.upsert(planData, { conflictFields: ['name'] });
    }
    console.log('✅ Plans seeded');

    // ─── SUPER ADMIN ──────────────────────────────────────────────────────
    const saEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@platform.com';
    const saPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
    const saHash = await bcrypt.hash(saPassword, 12);

    const [superAdmin] = await User.upsert({
      name: 'Super Admin',
      email: saEmail,
      password: saHash,
      role: 'superadmin',
      isActive: true,
    }, { conflictFields: ['email'] });
    console.log('✅ Super Admin seeded');

    // ─── DEMO ORGANIZATION ────────────────────────────────────────────────
    const webhookToken = uuidv4().replace(/-/g, '');
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    const [demoOrg] = await Organization.upsert({
      name: 'Sunrise Digital',
      slug: 'sunrise-digital',
      ownerEmail: 'owner@sunrisedigital.com',
      ownerName: 'Rajesh Kumar',
      ownerPhone: '+91 98765 43210',
      plan: 'growth',
      planExpiresAt: expiresAt,
      isActive: true,
      isSuspended: false,
      maxWorkspaces: 5,
      maxUsersPerWorkspace: 15,
      maxLeadsTotal: 10000,
      canUseWebhooks: true,
      canUsePDF: true,
      canUseCSVImport: true,
      canUseContentCalendar: true,
      canUseAdvancedReports: true,
      webhookToken,
      settings: {
        branding: {
          logo: null,
          companyName: 'Sunrise Digital',
          address: '42 MG Road, Bangalore, Karnataka 560001',
          gst: '29AABCS1234A1Z5',
          phone: '+91 98765 43210',
          email: 'billing@sunrisedigital.com',
          website: 'https://sunrisedigital.com',
        },
        smtpConfig: null,
      },
    }, { conflictFields: ['slug'] });
    console.log('✅ Demo organization seeded');

    // ─── OWNER USER ───────────────────────────────────────────────────────
    const ownerHash = await bcrypt.hash('Owner@123', 12);
    const [ownerUser] = await User.upsert({
      organizationId: demoOrg.id,
      workspaceId: null,
      name: 'Rajesh Kumar',
      email: 'owner@sunrisedigital.com',
      password: ownerHash,
      role: 'owner',
      phone: '+91 98765 43210',
      isActive: true,
    }, { conflictFields: ['email'] });
    console.log('✅ Owner user seeded');

    // ─── WORKSPACES ───────────────────────────────────────────────────────
    const [wsRealEstate] = await Workspace.findOrCreate({
      where: { organizationId: demoOrg.id, slug: 'real-estate' },
      defaults: {
        name: 'Real Estate Division',
        description: 'Managing all real estate client campaigns',
        isActive: true,
        webhookToken: crypto.randomBytes(32).toString('hex'),
        settings: {},
      },
    });

    const [wsEducation] = await Workspace.findOrCreate({
      where: { organizationId: demoOrg.id, slug: 'education' },
      defaults: {
        name: 'Education Division',
        description: 'Managing education sector clients',
        isActive: true,
        webhookToken: crypto.randomBytes(32).toString('hex'),
        settings: {},
      },
    });
    console.log('✅ Workspaces seeded');

    // ─── USERS PER WORKSPACE ──────────────────────────────────────────────
    const userCredentials = [];

    const createUser = async (data) => {
      const hash = await bcrypt.hash(data.password, 12);
      try {
        const [user] = await User.upsert({ ...data, password: hash, isActive: true }, { conflictFields: ['email'] });
        userCredentials.push({ role: data.role, email: data.email, password: data.password, workspace: data.workspaceName });
        return user;
      } catch {
        return await User.findOne({ where: { email: data.email } });
      }
    };

    // Real Estate workspace users
    const adminRE = await createUser({
      organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
      name: 'Priya Sharma', email: 'admin.realestate@sunrisedigital.com',
      password: 'Admin@123', role: 'admin', phone: '+91 87654 32109',
      workspaceName: 'Real Estate Division',
    });
    const agent1RE = await createUser({
      organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
      name: 'Amit Patel', email: 'agent1.realestate@sunrisedigital.com',
      password: 'Agent@123', role: 'agent', phone: '+91 76543 21098',
      workspaceName: 'Real Estate Division',
    });
    const agent2RE = await createUser({
      organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
      name: 'Sneha Iyer', email: 'agent2.realestate@sunrisedigital.com',
      password: 'Agent@123', role: 'agent', phone: '+91 65432 10987',
      workspaceName: 'Real Estate Division',
    });
    const designerRE = await createUser({
      organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
      name: 'Rohit Menon', email: 'designer.realestate@sunrisedigital.com',
      password: 'Designer@123', role: 'designer', phone: '+91 54321 09876',
      workspaceName: 'Real Estate Division',
    });

    // Education workspace users
    const adminEdu = await createUser({
      organizationId: demoOrg.id, workspaceId: wsEducation.id,
      name: 'Kavya Nair', email: 'admin.education@sunrisedigital.com',
      password: 'Admin@123', role: 'admin', phone: '+91 43210 98765',
      workspaceName: 'Education Division',
    });
    const agent1Edu = await createUser({
      organizationId: demoOrg.id, workspaceId: wsEducation.id,
      name: 'Vikram Singh', email: 'agent1.education@sunrisedigital.com',
      password: 'Agent@123', role: 'agent', phone: '+91 32109 87654',
      workspaceName: 'Education Division',
    });
    const agent2Edu = await createUser({
      organizationId: demoOrg.id, workspaceId: wsEducation.id,
      name: 'Ananya Rao', email: 'agent2.education@sunrisedigital.com',
      password: 'Agent@123', role: 'agent', phone: '+91 21098 76543',
      workspaceName: 'Education Division',
    });
    const designerEdu = await createUser({
      organizationId: demoOrg.id, workspaceId: wsEducation.id,
      name: 'Deepak Verma', email: 'designer.education@sunrisedigital.com',
      password: 'Designer@123', role: 'designer', phone: '+91 10987 65432',
      workspaceName: 'Education Division',
    });
    console.log('✅ Users seeded');

    // ─── LEADS ────────────────────────────────────────────────────────────
    const leadsData = [
      {
        organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
        name: 'Suresh Mehta', phone: '+91 98765 11111', email: 'suresh@example.com',
        source: 'Meta Ads', campaign: 'FB - Prestige City Campaign',
        status: 'Won', priority: 'Hot', score: 85, isHot: true,
        assignedTo: agent1RE.id, clientType: 'Real Estate',
        clientAddress: '15 MG Road, Bangalore',
        metadata: { fb_form_id: 'form_123', ad_name: 'Prestige City 3BHK' },
      },
      {
        organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
        name: 'Meera Joshi', phone: '+91 98765 22222', email: 'meera@example.com',
        source: 'Google Ads', campaign: 'Google - Luxury Homes',
        status: 'Quotation', priority: 'High', score: 72, isHot: true,
        assignedTo: agent1RE.id, clientType: 'Real Estate',
        clientAddress: '28 Church Street, Bangalore',
        metadata: { keyword: 'luxury apartments bangalore' },
      },
      {
        organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
        name: 'Kiran Desai', phone: '+91 98765 33333', email: 'kiran@example.com',
        source: 'Website', campaign: null,
        status: 'Meeting', priority: 'High', score: 65,
        assignedTo: agent2RE.id, clientType: 'Construction',
        clientAddress: '7 Residency Road, Bangalore',
        metadata: {},
      },
      {
        organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
        name: 'Ravi Chandran', phone: '+91 98765 44444',
        source: 'WhatsApp', campaign: null,
        status: 'Discussion', priority: 'Medium', score: 45,
        assignedTo: agent2RE.id, clientType: 'Real Estate',
        metadata: {},
      },
      {
        organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
        name: 'Preeti Shah', phone: '+91 98765 55555', email: 'preeti@example.com',
        source: 'Reference', campaign: 'Referred by Suresh Mehta',
        status: 'New', priority: 'High', score: 55,
        assignedTo: agent1RE.id, clientType: 'Real Estate',
        metadata: {},
      },
      {
        organizationId: demoOrg.id, workspaceId: wsRealEstate.id,
        name: 'Anil Kumar', phone: '+91 98765 66666',
        source: 'Meta Ads', campaign: 'FB - Whitefield Homes',
        status: 'Lost', priority: 'Low', score: 20,
        assignedTo: agent1RE.id, clientType: 'Real Estate',
        metadata: { reason_lost: 'Budget constraints' },
      },
      {
        organizationId: demoOrg.id, workspaceId: wsEducation.id,
        name: 'Sunita College', phone: '+91 98765 77777', email: 'sunita@college.edu',
        source: 'Google Ads', campaign: 'Google - Education Ads',
        status: 'Discussion', priority: 'Hot', score: 78, isHot: true,
        assignedTo: agent1Edu.id, clientType: 'College',
        clientAddress: '100 University Road, Pune',
        metadata: {},
      },
      {
        organizationId: demoOrg.id, workspaceId: wsEducation.id,
        name: 'Bright School', phone: '+91 98765 88888', email: 'admin@brightschool.in',
        source: 'Website', campaign: null,
        status: 'Quotation', priority: 'High', score: 68,
        assignedTo: agent1Edu.id, clientType: 'School',
        clientAddress: '55 Shivaji Nagar, Mumbai',
        metadata: {},
      },
      {
        organizationId: demoOrg.id, workspaceId: wsEducation.id,
        name: 'Dr. Prashant', phone: '+91 98765 99999', email: 'prashant@hospital.in',
        source: 'Instagram DM', campaign: null,
        status: 'New', priority: 'Medium', score: 40,
        assignedTo: agent2Edu.id, clientType: 'Hospital',
        metadata: { instagram_username: '@drprashantclinic' },
      },
      {
        organizationId: demoOrg.id, workspaceId: wsEducation.id,
        name: 'Rahul Branding', phone: '+91 87654 00001', email: 'rahul@brand.in',
        source: 'Social Media', campaign: 'LinkedIn Outreach',
        status: 'Meeting', priority: 'High', score: 60,
        assignedTo: agent2Edu.id, clientType: 'Personal Branding',
        metadata: { linkedin_profile: 'linkedin.com/in/rahulbranding' },
      },
    ];

    const createdLeads = [];
    for (const leadData of leadsData) {
      const lead = await Lead.create(leadData);
      createdLeads.push(lead);
      await LeadActivity.create({
        leadId: lead.id,
        organizationId: lead.organizationId,
        workspaceId: lead.workspaceId,
        userId: null,
        type: 'created',
        description: `Lead created via ${lead.source}`,
        metadata: {},
      });
    }
    console.log('✅ Leads seeded');

    // ─── FOLLOWUPS ────────────────────────────────────────────────────────
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);

    await Followup.create({
      leadId: createdLeads[1].id,
      organizationId: demoOrg.id,
      workspaceId: wsRealEstate.id,
      userId: agent1RE.id,
      scheduledAt: tomorrow,
      note: 'Call to discuss quotation approval',
      status: 'pending',
    });

    await Followup.create({
      leadId: createdLeads[2].id,
      organizationId: demoOrg.id,
      workspaceId: wsRealEstate.id,
      userId: agent2RE.id,
      scheduledAt: yesterday,
      note: 'Post-meeting follow-up',
      status: 'overdue',
    });
    console.log('✅ Followups seeded');

    // ─── QUOTATION ────────────────────────────────────────────────────────
    const quotation = await Quotation.create({
      organizationId: demoOrg.id,
      workspaceId: wsRealEstate.id,
      quotationNumber: 'QTN-0001',
      leadId: createdLeads[1].id,
      createdBy: adminRE.id,
      clientName: createdLeads[1].name,
      clientEmail: createdLeads[1].email,
      clientPhone: createdLeads[1].phone,
      status: 'Sent',
      subtotal: 85000,
      gstPercent: 18,
      gstAmount: 15300,
      totalAmount: 100300,
      terms: 'Payment due within 30 days of approval.',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sentAt: new Date(),
    });

    await QuotationItem.bulkCreate([
      { quotationId: quotation.id, description: 'Social Media Management (3 months)', quantity: 3, unitPrice: 15000, totalPrice: 45000 },
      { quotationId: quotation.id, description: 'Google Ads Management', quantity: 1, unitPrice: 25000, totalPrice: 25000 },
      { quotationId: quotation.id, description: 'SEO Optimization', quantity: 1, unitPrice: 15000, totalPrice: 15000 },
    ]);
    console.log('✅ Quotation seeded');

    // ─── INVOICE ──────────────────────────────────────────────────────────
    const invoice = await Invoice.create({
      organizationId: demoOrg.id,
      workspaceId: wsRealEstate.id,
      invoiceNumber: 'INV-0001',
      quotationId: null,
      leadId: createdLeads[0].id,
      createdBy: adminRE.id,
      clientName: createdLeads[0].name,
      clientEmail: createdLeads[0].email,
      clientPhone: createdLeads[0].phone,
      subtotal: 120000,
      gstPercent: 18,
      gstAmount: 21600,
      totalAmount: 141600,
      paidAmount: 70000,
      dueAmount: 71600,
      status: 'Partial',
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      terms: '50% advance, 50% on completion',
    });

    // ─── PAYMENT ──────────────────────────────────────────────────────────
    await Payment.create({
      organizationId: demoOrg.id,
      workspaceId: wsRealEstate.id,
      invoiceId: invoice.id,
      leadId: createdLeads[0].id,
      receivedBy: adminRE.id,
      amount: 70000,
      mode: 'Bank Transfer',
      reference: 'NEFT20240115001',
      note: 'First advance payment',
      receivedAt: new Date(),
    });
    console.log('✅ Invoice & Payment seeded');

    // ─── CONTENT TASKS ────────────────────────────────────────────────────
    await ContentTask.create({
      organizationId: demoOrg.id,
      workspaceId: wsRealEstate.id,
      leadId: createdLeads[0].id,
      assignedTo: designerRE.id,
      createdBy: adminRE.id,
      title: 'Prestige City Instagram Campaign Creatives',
      description: 'Create 12 posts and 6 reels for the launch campaign',
      platform: 'Instagram',
      contentType: 'Post',
      status: 'In Progress',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await ContentTask.create({
      organizationId: demoOrg.id,
      workspaceId: wsEducation.id,
      leadId: createdLeads[6].id,
      assignedTo: designerEdu.id,
      createdBy: adminEdu.id,
      title: 'Sunita College Banner Ads',
      description: 'Google Display banners in multiple sizes',
      platform: 'Google',
      contentType: 'Banner',
      status: 'Pending',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    console.log('✅ Content tasks seeded');

    // ─── NOTIFICATIONS ────────────────────────────────────────────────────
    const notifData = [
      { userId: agent1RE.id, type: 'lead_assigned', title: 'New Lead Assigned', message: 'Meera Joshi has been assigned to you', workspaceId: wsRealEstate.id },
      { userId: agent2RE.id, type: 'followup_due', title: 'Followup Overdue', message: 'Followup with Kiran Desai is overdue', workspaceId: wsRealEstate.id },
      { userId: adminRE.id, type: 'new_lead', title: 'New Lead Arrived', message: 'Preeti Shah arrived via Reference', workspaceId: wsRealEstate.id },
      { userId: agent1Edu.id, type: 'lead_assigned', title: 'New Lead Assigned', message: 'Sunita College has been assigned to you', workspaceId: wsEducation.id },
      { userId: ownerUser.id, type: 'plan_expiring', title: 'Plan Expiring Soon', message: 'Your Growth plan expires in 7 days', workspaceId: null },
    ];

    for (const n of notifData) {
      await Notification.create({ ...n, organizationId: demoOrg.id, data: {}, isRead: false });
    }
    console.log('✅ Notifications seeded');

    // ─── PRINT CREDENTIALS ────────────────────────────────────────────────
    console.log('\n' + '='.repeat(70));
    console.log('                    SEED CREDENTIALS SUMMARY');
    console.log('='.repeat(70));
    console.log('\n📌 SUPER ADMIN:');
    console.log(`   Email   : ${saEmail}`);
    console.log(`   Password: ${saPassword}`);
    console.log('\n📌 OWNER:');
    console.log(`   Org     : Sunrise Digital`);
    console.log(`   Email   : owner@sunrisedigital.com`);
    console.log(`   Password: Owner@123`);
    console.log('\n📌 WORKSPACE USERS:');
    for (const cred of userCredentials) {
      console.log(`   [${cred.role.toUpperCase().padEnd(8)}] ${cred.email.padEnd(45)} | ${cred.password} | ${cred.workspace}`);
    }
    console.log('\n📌 WEBHOOK TOKEN:');
    console.log(`   Token: ${webhookToken}`);
    console.log(`   Meta: POST /webhooks/${webhookToken}/meta`);
    console.log('='.repeat(70));
    console.log('\n✅ Seed completed successfully!\n');

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();
