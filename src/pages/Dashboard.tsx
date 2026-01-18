import { useEffect, useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { useI18n } from '../lib/useI18n';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [projects, setProjects] = useState<any[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    const { data: projectsData, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !projectsData) {
      setLoading(false);
      return;
    }

    setProjects(projectsData);

    const previews: Record<string, string> = {};
    const progresses: Record<string, number> = {};

    for (const project of projectsData) {
      if (project.preview_path) {
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from('project-assets')
          .createSignedUrl(project.preview_path, 3600);
        if (!urlError && signedUrlData?.signedUrl) {
          previews[project.id] = signedUrlData.signedUrl;
        }
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('completed')
        .eq('project_id', project.id);
      
      if (!tasksError && tasksData) {
        const completed = tasksData.filter((t: any) => t.completed).length;
        progresses[project.id] = tasksData.length ? Math.round((completed / tasksData.length) * 100) : 0;
      }
    }

    setPreviewUrls(previews);
    setProgressMap(progresses);
    setLoading(false);
  };

  const handleCreate = async () => {
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({ 
        user_id: user.id, 
        title: '', 
        description: '',
        additional_info: '' // ← новое поле
      })
      .select()
      .single();
    
    if (!error && newProject) {
      navigate(`/project/${newProject.id}`);
    }
  };

  if (loading) return <div>{t('loading')}...</div>;

  return (
    <div>
      {/* Описание на главной */}
      <div style={{ 
        marginBottom: '24px', 
        padding: '16px', 
        background: 'rgba(0, 20, 0, 0.3)', 
        borderRadius: '12px',
        border: '1px solid rgba(0, 255, 0, 0.2)'
      }}>
        <h2 style={{ color: '#0f0', margin: '0 0 8px 0' }}>{t('welcome_title')}</h2>
        <p style={{ color: '#0f0', opacity: 0.8, margin: 0, lineHeight: 1.5 }}>
          {t('welcome_description')}
        </p>
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <h1 style={{ 
          color: '#0f0', 
          margin: 0,
          fontSize: '24px',
          fontWeight: '600'
        }}>
          {t('projects')}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => logout()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {t('logout')}
          </button>
          <button
            onClick={handleCreate}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            + {t('new_project')}
          </button>
        </div>
      </div>

      {/* Призыв к действию */}
      {projects.length > 0 && (
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '24px', 
          padding: '12px',
          background: 'rgba(106, 13, 173, 0.2)',
          borderRadius: '8px',
          border: '1px solid rgba(106, 13, 173, 0.3)'
        }}>
          <p style={{ 
            color: '#e0b0ff', 
            margin: 0,
            fontSize: '16px',
            fontWeight: '500'
          }}>
            {t('create_with_ai_prompt')}
          </p>
        </div>
      )}

      {projects.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: '#0f0',
          opacity: 0.7
        }}>
          {t('no_projects_yet')}
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '16px'
        }}>
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => navigate(`/project/${project.id}`)}
              style={{
                background: 'rgba(20, 20, 30, 0.8)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                border: '1px solid rgba(0, 255, 0, 0.2)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ 
                width: '40px', 
                height: '40px', 
                background: '#007bff', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                marginBottom: '12px',
                fontSize: '18px'
              }}>
                {project.title.charAt(0).toUpperCase() || 'P'}
              </div>

              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '10px',
                fontWeight: 'bold',
                background: 'rgba(0, 255, 0, 0.2)',
                padding: '2px 6px',
                borderRadius: '10px'
              }}>
                {progressMap[project.id] || 0}%
              </div>

              <h3 style={{ 
                margin: '0 0 6px 0', 
                fontSize: '16px',
                color: '#0f0',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {project.title || t('new_project')}
              </h3>
              
              <p style={{ 
                fontSize: '12px', 
                color: '#0f0',
                opacity: 0.7,
                margin: 0,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {project.description || t('no_description')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
