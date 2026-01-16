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
    const {   projectsData } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!projectsData) {
      setLoading(false);
      return;
    }

    setProjects(projectsData);

    const previews: Record<string, string> = {};
    const progresses: Record<string, number> = {};

    for (const project of projectsData) {
      if (project.preview_path) {
        const {   signedUrlData } = await supabase.storage
          .from('project-assets')
          .createSignedUrl(project.preview_path, 3600);
        if (signedUrlData?.signedUrl) {
          previews[project.id] = signedUrlData.signedUrl;
        }
      }

      const {   tasksData } = await supabase
        .from('tasks')
        .select('completed')
        .eq('project_id', project.id);
      
      if (tasksData) {
        const completed = tasksData.filter((t: any) => t.completed).length;
        progresses[project.id] = tasksData.length ? Math.round((completed / tasksData.length) * 100) : 0;
      }
    }

    setPreviewUrls(previews);
    setProgressMap(progresses);
    setLoading(false);
  };

  const handleCreate = async () => {
    const {   newProject } = await supabase
      .from('projects')
      .insert({ user_id: user.id, title: t('new_project'), description: '' })
      .select()
      .single();
    navigate(`/project/${newProject.id}`);
  };

  if (loading) return <div>{t('loading')}...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ color: '#0f0' }}>{t('projects')}</h1>
        <div>
          <button
            onClick={() => logout()}
            style={{
              padding: '6px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              marginRight: '8px'
            }}
          >
            {t('logout')}
          </button>
          <button
            onClick={handleCreate}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            + {t('new_project')}
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <p style={{ color: '#0f0' }}>{t('no_projects_yet')}</p>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => navigate(`/project/${project.id}`)}
              style={{
                padding: '12px',
                border: '1px solid #0f0',
                borderRadius: '8px',
                cursor: 'pointer',
                background: 'rgba(0, 20, 0, 0.6)',
                color: '#0f0',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {progressMap[project.id] || 0}%
              </div>

              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>{project.title}</h3>
              
              {previewUrls[project.id] && (
                <div style={{ height: '60px', overflow: 'hidden', borderRadius: '4px', marginBottom: '6px' }}>
                  {previewUrls[project.id]?.endsWith('.mp4') ? (
                    <video src={previewUrls[project.id]} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={previewUrls[project.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
              )}

              <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>
                {project.description.substring(0, 80)}{project.description.length > 80 ? '...' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
