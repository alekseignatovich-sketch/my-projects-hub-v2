import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { useI18n } from '../lib/useI18n';
import { supabase } from '../lib/supabase';
import { getAIResponse } from '../lib/aiAssistant';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [project, setProject] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiError, setAiError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !id) return;
    loadProjectData();
  }, [user, id]);

  const loadProjectData = async () => {
    const { data: projectData, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !projectData) {
      navigate('/');
      return;
    }

    setProject(projectData);
    setTitle(projectData.title || '');
    setDescription(projectData.description || '');

    if (projectData.preview_path) {
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('project-assets')
        .createSignedUrl(projectData.preview_path, 3600);
      if (!urlError && signedUrlData?.signedUrl) {
        setPreviewUrl(signedUrlData.signedUrl);
      }
    }

    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', id)
      .order('position', { ascending: true });
    if (!tasksError) {
      setTasks(tasksData || []);
    }

    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select('content')
      .eq('project_id', id)
      .single();
    if (!notesError) {
      setNotes(notesData?.content || '');
    }
  };

  const handleSaveProject = async () => {
    const finalTitle = title.trim() || t('new_project'); // Обязательное название
    
    const { error } = await supabase
      .from('projects')
      .update({ 
        title: finalTitle, 
        description: description.trim(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (!error) {
      setProject((prev: any) => ({ ...prev, title: finalTitle, description: description.trim() }));
      alert(t('save_success'));
    }
  };

  const handleDeleteProject = async () => {
    const confirmed = window.confirm(t('confirm_delete_project'));
    if (!confirmed) return;

    if (project.preview_path) {
      await supabase.storage
        .from('project-assets')
        .remove([project.preview_path]);
    }

    await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    navigate('/');
  };

  const handleUploadPreview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `projects/${id}/preview.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('project-assets')
      .upload(filePath, file, { upsert: true });

    if (!uploadError) {
      await supabase
        .from('projects')
        .update({ preview_path: filePath, updated_at: new Date().toISOString() })
        .eq('id', id);
      loadProjectData();
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !id) return;

    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        project_id: id,
        title: newTaskTitle.trim(),
        completed: false,
        hours_spent: 0
      })
      .select()
      .single();

    if (!error && newTask) {
      setTasks([...tasks, newTask]);
      setNewTaskTitle('');
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    await supabase
      .from('tasks')
      .update({ completed })
      .eq('id', taskId);
    setTasks(tasks.map(t => t.id === taskId ? { ...t, completed } : t));
  };

  const handleUpdateHours = async (taskId: string, hoursStr: string) => {
    const hours = parseFloat(hoursStr) || 0;
    await supabase
      .from('tasks')
      .update({ hours_spent: hours })
      .eq('id', taskId);
    setTasks(tasks.map(t => t.id === taskId ? { ...t, hours_spent: hours } : t));
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    const { error } = await supabase
      .from('notes')
      .upsert(
        { 
          project_id: id, 
          content: notes,
          updated_at: new Date().toISOString()
        },
        { 
          onConflict: 'project_id',
          ignoreDuplicates: false 
        }
      );
    if (!error) {
      alert(t('notes_saved'));
    }
  };

  const handleAIAssist = async (type: 'description' | 'tasks' | 'improve' | 'notes') => {
    if (!project) return;
    
    setIsGenerating(true);
    setAiResponse('');
    setAiError('');

    try {
      const currentDescription = description.trim() || 'No description provided';
      let prompt = '';
      
      switch (type) {
        case 'description':
          prompt = `Create a professional project description based on the title "${title}". Make it concise (2-3 sentences) in business style.`;
          break;
          
        case 'tasks':
          prompt = `Based on the project "${title}" with description: "${currentDescription}", break it down into 5 specific implementation stages. Each stage should start with a verb (e.g., "Create", "Develop", "Design"). Provide as a comma-separated list.`;
          break;
          
        case 'improve':
          prompt = `Analyze the project "${title}" with description: "${currentDescription}". Suggest 3 specific improvements or development ideas. Keep it brief and actionable.`;
          break;
          
        case 'notes':
          prompt = `Based on the project "${title}" with description: "${currentDescription}", write comprehensive notes for the implementation phase. Include tips, potential risks to watch for, and key considerations. Length: 3-4 sentences.`;
          break;
      }

      const response = await getAIResponse(prompt);
      setAiResponse(response);
    } catch (error) {
      setAiError((error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const progress = tasks.length
    ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
    : 0;

  if (!project) return <div>{t('loading')}...</div>;

  return (
    <div>
      {/* Заголовок с редактируемым названием */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '24px' 
      }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('project_title_placeholder')}
            style={{ 
              width: '100%',
              fontSize: '24px',
              fontWeight: '600',
              color: '#0f0',
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid rgba(0, 255, 0, 0.3)',
              padding: '4px 0',
              marginBottom: '8px'
            }}
          />
          <span style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: '#0f0',
            background: 'rgba(0, 255, 0, 0.2)',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            {progress}%
          </span>
        </div>
      </div>

      {/* Кнопки ИИ */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
        gap: '8px', 
        marginBottom: '24px' 
      }}>
        <button
          onClick={() => handleAIAssist('description')}
          disabled={isGenerating}
          style={{
            padding: '8px',
            fontSize: '12px',
            backgroundColor: '#6a0dad',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '500'
          }}
        >
          📝 {t('ai_description')}
        </button>
        <button
          onClick={() => handleAIAssist('tasks')}
          disabled={isGenerating}
          style={{
            padding: '8px',
            fontSize: '12px',
            backgroundColor: '#6a0dad',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '500'
          }}
        >
          ✅ {t('ai_tasks')}
        </button>
        <button
          onClick={() => handleAIAssist('improve')}
          disabled={isGenerating}
          style={{
            padding: '8px',
            fontSize: '12px',
            backgroundColor: '#6a0dad',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '500'
          }}
        >
          💡 {t('ai_improve')}
        </button>
        <button
          onClick={() => handleAIAssist('notes')}
          disabled={isGenerating}
          style={{
            padding: '8px',
            fontSize: '12px',
            backgroundColor: '#6a0dad',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '500'
          }}
        >
          📓 {t('ai_notes')}
        </button>
      </div>

      {/* Ошибки ИИ */}
      {aiError && (
        <div style={{ 
          padding: '10px', 
          background: 'rgba(220, 53, 69, 0.2)', 
          color: '#ff6b6b',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          {aiError}
        </div>
      )}

      {/* Ответ ИИ */}
      {aiResponse && (
        <div style={{
          padding: '12px',
          background: 'rgba(106, 13, 173, 0.2)',
          border: '1px solid #6a0dad',
          borderRadius: '8px',
          color: '#e0b0ff',
          whiteSpace: 'pre-wrap',
          marginBottom: '24px'
        }}>
          {aiResponse}
        </div>
      )}

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={t('description_placeholder')}
        rows={3}
        style={{ 
          width: '100%', 
          padding: '12px',
          marginBottom: '24px',
          fontSize: '16px',
          border: '1px solid rgba(0, 255, 0, 0.3)',
          borderRadius: '8px',
          background: 'rgba(20, 20, 30, 0.8)',
          color: '#0f0'
        }}
      />

      {previewUrl && (
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          {previewUrl.endsWith('.mp4') ? (
            <video
              src={previewUrl}
              controls
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                width: 'auto',
                height: 'auto',
                borderRadius: '8px'
              }}
            />
          ) : (
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                width: 'auto',
                height: 'auto',
                borderRadius: '8px'
              }}
            />
          )}
        </div>
      )}

      <button
        onClick={() => document.getElementById('preview-input')?.click()}
        style={{
          marginBottom: '24px',
          padding: '10px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500'
        }}
      >
        {t('upload_preview')}
      </button>
      <input
        id="preview-input"
        type="file"
        accept="image/*,video/mp4,.gif"
        onChange={handleUploadPreview}
        style={{ display: 'none' }}
      />

      <h3 style={{ color: '#0f0', marginBottom: '16px', fontSize: '18px' }}>
        {t('tasks')} ({tasks.filter(t => t.completed).length}/{tasks.length})
      </h3>
      <div style={{ marginBottom: '24px' }}>
        {tasks.map(task => (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={e => handleToggleTask(task.id, e.target.checked)}
              style={{ marginRight: '12px', transform: 'scale(1.3)' }}
            />
            <span style={{ flex: 1, fontSize: '16px', color: '#0f0' }}>{task.title}</span>
            <input
              type="number"
              step="0.25"
              min="0"
              value={task.hours_spent}
              onChange={e => handleUpdateHours(task.id, e.target.value)}
              placeholder="0"
              style={{ 
                width: '80px', 
                padding: '6px', 
                fontSize: '14px', 
                textAlign: 'right', 
                background: 'rgba(20, 20, 30, 0.8)',
                border: '1px solid rgba(0, 255, 0, 0.3)',
                color: '#0f0',
                borderRadius: '4px'
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          placeholder={t('task_title')}
          style={{ 
            flex: 1, 
            padding: '10px', 
            fontSize: '16px', 
            border: '1px solid rgba(0, 255, 0, 0.3)',
            borderRadius: '8px',
            background: 'rgba(20, 20, 30, 0.8)',
            color: '#0f0'
          }}
        />
        <button
          onClick={handleAddTask}
          disabled={!newTaskTitle.trim()}
          style={{
            padding: '10px 16px',
            backgroundColor: newTaskTitle.trim() ? '#28a745' : '#444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          +
        </button>
      </div>

      <h3 style={{ color: '#0f0', marginBottom: '16px', fontSize: '18px' }}>{t('notes')}</h3>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder={t('notes_placeholder')}
        rows={6}
        style={{ 
          width: '100%', 
          padding: '12px',
          fontSize: '16px',
          border: '1px solid rgba(0, 255, 0, 0.3)',
          borderRadius: '8px',
          background: 'rgba(20, 20, 30, 0.8)',
          color: '#0f0',
          marginBottom: '16px'
        }}
      />
      <button
        onClick={handleSaveNotes}
        style={{
          padding: '10px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '24px'
        }}
      >
        {t('save_notes')}
      </button>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ← {t('back_to_projects')}
        </button>
        <button
          onClick={handleSaveProject}
          style={{
            padding: '10px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {t('save')}
        </button>
        <button
          onClick={handleDeleteProject}
          style={{
            padding: '10px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {t('delete_project')}
        </button>
      </div>
    </div>
  );
}
