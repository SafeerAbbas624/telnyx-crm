// Simple API test to verify pagination is working
// Run this after deploying to test the optimized endpoints

const testApiPagination = async () => {
  console.log('🧪 Testing API Pagination...\n');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    // Test 1: Basic contacts API with pagination
    console.log('📊 Test 1: Contacts API Pagination');
    const response1 = await fetch(`${baseUrl}/api/contacts?page=1&limit=5`);
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('✅ Contacts API Response Structure:');
      console.log(`   - Contacts returned: ${data1.contacts?.length || 0}`);
      console.log(`   - Has pagination: ${data1.pagination ? 'Yes' : 'No'}`);
      if (data1.pagination) {
        console.log(`   - Page: ${data1.pagination.page}`);
        console.log(`   - Total: ${data1.pagination.totalCount}`);
        console.log(`   - Has more: ${data1.pagination.hasMore}`);
      }
    } else {
      console.log(`❌ Contacts API failed: ${response1.status}`);
    }

    // Test 2: Search functionality
    console.log('\n📊 Test 2: Search Functionality');
    const response2 = await fetch(`${baseUrl}/api/contacts?page=1&limit=5&search=john`);
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log('✅ Search API Response:');
      console.log(`   - Search results: ${data2.contacts?.length || 0}`);
      console.log(`   - Total matches: ${data2.pagination?.totalCount || 0}`);
    } else {
      console.log(`❌ Search API failed: ${response2.status}`);
    }

    // Test 3: Filter functionality
    console.log('\n📊 Test 3: Filter Functionality');
    const response3 = await fetch(`${baseUrl}/api/contacts?page=1&limit=5&dealStatus=lead`);
    
    if (response3.ok) {
      const data3 = await response3.json();
      console.log('✅ Filter API Response:');
      console.log(`   - Filtered results: ${data3.contacts?.length || 0}`);
      console.log(`   - Total leads: ${data3.pagination?.totalCount || 0}`);
    } else {
      console.log(`❌ Filter API failed: ${response3.status}`);
    }

    console.log('\n🎉 API Pagination Tests Completed!');

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
};

// Run the test
testApiPagination();
