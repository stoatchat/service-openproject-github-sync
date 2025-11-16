/**
 * OpenProject Configuration Finder
 *
 * Run this in your browser console while logged into OpenProject
 * (https://op.stoatinternal.com)
 *
 * This will help you find all the configuration values needed for .env
 */

// IMPORTANT: Replace this with your actual OpenProject API token
const OP_TOKEN = 'YOUR_OPENPROJECT_TOKEN_HERE';
const API_BASE = 'https://op.stoatinternal.com/api/v3';

// Helper function to make authenticated requests
async function opFetch(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Authorization': 'Basic ' + btoa(`apikey:${OP_TOKEN}`),
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error (${response.status}): ${error}`);
  }

  return response.json();
}

console.log('🔍 Finding OpenProject Configuration Values...\n');

// Test 1: Verify authentication
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. Testing API Token Authentication');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

opFetch('/projects')
  .then(data => {
    console.log('✅ Token is valid!\n');

    // Test 2: Find backend project
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2. Finding Backend Project ID');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return opFetch('/projects/backend');
  })
  .then(project => {
    console.log(`✅ Backend Project ID: ${project.id}`);
    console.log(`   Name: ${project.name}`);
    console.log(`   Identifier: ${project.identifier}\n`);
    console.log(`📝 Update .env with: REPO_PROJECT_MAP=stoatchat/stoatchat:${project.id}\n`);

    // Test 3: Find types
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3. Finding Work Package Types');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return opFetch('/types');
  })
  .then(types => {
    console.log('✅ Available Types:');
    const typeList = types._embedded.elements.map(t => `   ${t.id}: ${t.name}`).join('\n');
    console.log(typeList + '\n');

    // Build TYPE_MAP suggestion
    const commonTypes = types._embedded.elements.filter(t =>
      ['bug', 'task', 'feature'].includes(t.name.toLowerCase())
    );

    if (commonTypes.length > 0) {
      const typeMap = commonTypes.map(t => `${t.name}:${t.id}`).join(',');
      console.log(`📝 Suggested TYPE_MAP: ${typeMap}\n`);
    }

    // Test 4: Find custom fields
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4. Finding Custom Fields');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Try to fetch a work package to see custom fields
    return opFetch('/work_packages?pageSize=1');
  })
  .then(workPackages => {
    if (workPackages._embedded.elements.length > 0) {
      const wp = workPackages._embedded.elements[0];
      const customFields = Object.keys(wp).filter(k => k.startsWith('customField'));

      if (customFields.length > 0) {
        console.log('✅ Found custom fields:');
        customFields.forEach(field => {
          console.log(`   ${field}: ${wp[field]}`);
        });
        console.log('\n📝 Look for the "GitHub Issue" field above');
        console.log('   It should be an integer field, likely empty (null) or containing a GitHub issue number\n');
      } else {
        console.log('⚠️  No custom fields found on work packages');
        console.log('   You may need to create a "GitHub Issue" integer custom field in OpenProject\n');
      }
    } else {
      console.log('⚠️  No work packages found to inspect custom fields\n');
    }

    // Test 5: Find users
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('5. Finding Users (for ASSIGNEE_MAP)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return opFetch('/users');
  })
  .then(users => {
    console.log('✅ Available Users:');
    users._embedded.elements.slice(0, 10).forEach(u => {
      console.log(`   ${u.id}: ${u.login} (${u.firstName} ${u.lastName})`);
    });

    if (users._embedded.elements.length > 10) {
      console.log(`   ... and ${users._embedded.elements.length - 10} more`);
    }

    console.log('\n📝 Map GitHub usernames to these IDs in ASSIGNEE_MAP');
    console.log('   Example: ASSIGNEE_MAP=githubuser:42,anotheruser:43\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Configuration Discovery Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nNext steps:');
    console.log('1. Update your .env file with the values shown above');
    console.log('2. Generate a SECRET_TOKEN: openssl rand -hex 32');
    console.log('3. Find the "GitHub Issue" custom field ID from step 4');
    console.log('4. Map GitHub usernames to OpenProject user IDs\n');
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you are logged into OpenProject in this browser');
    console.error('2. Check that the API token is correct and active');
    console.error('3. Verify the token has API access permissions in your OpenProject user settings');
    console.error('4. Try regenerating the API token: User Settings → Access Tokens\n');
  });
