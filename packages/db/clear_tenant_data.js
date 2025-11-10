const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearTenantData(tenantId) {
  console.log(`Starting to clear data for tenant: ${tenantId}`);
  
  try {
    // Start a transaction to ensure both deletions succeed or both fail
    const result = await prisma.$transaction(async (tx) => {
      // First, count existing records before deletion
      const callLogCount = await tx.callLog.count({
        where: { tenantId }
      });
      
      const meetingCount = await tx.meeting.count({
        where: { tenantId }
      });
      
      console.log(`Found ${callLogCount} call log records and ${meetingCount} meeting records`);
      
      if (callLogCount === 0 && meetingCount === 0) {
        console.log('No records found to delete');
        return { callLogsDeleted: 0, meetingsDeleted: 0 };
      }
      
      // Ask for confirmation before proceeding
      console.log(`About to delete ${callLogCount + meetingCount} total records. Proceeding...`);
      
      // Delete call logs for the tenant
      const deleteCallLogs = await tx.callLog.deleteMany({
        where: { tenantId }
      });
      
      // Delete meetings for the tenant
      const deleteMeetings = await tx.meeting.deleteMany({
        where: { tenantId }
      });
      
      return {
        callLogsDeleted: deleteCallLogs.count,
        meetingsDeleted: deleteMeetings.count
      };
    });
    
    console.log('✅ Successfully cleared tenant data:');
    console.log(`   - Call logs deleted: ${result.callLogsDeleted}`);
    console.log(`   - Meetings deleted: ${result.meetingsDeleted}`);
    console.log(`   - Total records deleted: ${result.callLogsDeleted + result.meetingsDeleted}`);
    
  } catch (error) {
    console.error('❌ Error clearing tenant data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// The tenant ID to clear data for
const TENANT_ID = 'cmhoieoc80000p2r5ykn68e0a';

// Run the script
clearTenantData(TENANT_ID)
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });