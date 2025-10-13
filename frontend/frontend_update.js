// Update for App.js - Replace the client task fetching logic

// REPLACE THIS:
// if (response.data.user_type === 'client') {
//   // Show tasks posted by this client
//   const clientTasks = allTasks.filter(task => task.client === response.data.username);
//   setUserTasks(clientTasks);
// } else {
//   // For freelancers, we'd need to implement applications endpoint
//   // For now, just show empty array
//   setUserTasks([]);
// }

// WITH THIS:
if (response.data.user_type === 'client') {
  // Fetch tasks posted by this client from the backend
  try {
    const clientTasksResponse = await axios.get(`${API}/tasks/my-tasks`, {
      headers: { 'Authorization': `Bearer ${firebaseToken}` }
    });
    const clientTasks = Array.isArray(clientTasksResponse.data) 
      ? clientTasksResponse.data.map(mapTaskFromApi) 
      : [];
    setUserTasks(clientTasks);
  } catch (error) {
    console.error('Error fetching client tasks:', error);
    // Fallback to client-side filtering
    const clientTasks = allTasks.filter(task => task.client === response.data.username);
    setUserTasks(clientTasks);
  }
} else {
  // For freelancers, we'd need to implement applications endpoint
  // For now, just show empty array
  setUserTasks([]);
}
