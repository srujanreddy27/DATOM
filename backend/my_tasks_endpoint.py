# New endpoint to add to server.py

@api_router.get("/tasks/my-tasks", response_model=List[Task])
async def get_my_tasks(current_user: User = Depends(get_current_user)):
    """Get tasks posted by the current user (client only)"""
    if current_user.user_type != "client":
        raise HTTPException(status_code=403, detail="Only clients can view their posted tasks")
    
    await cleanup_tasks()
    
    # Get all tasks from Firebase
    all_tasks = await firebase_db.get_all_tasks()
    
    # Filter tasks by client username
    client_tasks = []
    for task_data in all_tasks:
        if task_data.get("client") == current_user.username:
            client_tasks.append(Task(**task_data))
    
    return client_tasks
