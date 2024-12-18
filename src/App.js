import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider } from './components/ui/toast';
import { useToast } from './components/ui/use-toast';
import Auth from './components/Auth';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import SearchBar from './components/SearchBar';
import DefectsTable from './components/DefectsTable';
import DefectDialog from './components/DefectDialog';
import ChatBot from './components/ChatBot/ChatBot';
import { supabase } from './supabaseClient';

const getUserVessels = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_vessels')
      .select(`
        vessel_id,
        vessels!inner (
          vessel_id,
          vessel_name
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user vessels:', error);
    throw error;
  }
};

function App() {
  const { toast } = useToast();
  
  const [session, setSession] = useState(null);
  const [data, setData] = useState([]);
  const [assignedVessels, setAssignedVessels] = useState([]);
  const [vesselNames, setVesselNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  
  const [currentVessel, setCurrentVessel] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState('');
  
  const [isDefectDialogOpen, setIsDefectDialogOpen] = useState(false);
  const [currentDefect, setCurrentDefect] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = useCallback(async () => {
  if (!session?.user?.id) return;

  try {
    setLoading(true);
    
    // First fetch - Get user vessels
    const { data: userVessels, error: vesselError } = await supabase
      .from('user_vessels')
      .select(`
        vessel_id,
        vessels!inner (
          vessel_id,
          vessel_name
        )
      `)
      .eq('user_id', session.user.id);

    if (vesselError) {
      console.error("Vessel fetch error:", vesselError);
      throw vesselError;
    }

    if (!userVessels?.length) {
      console.log("No vessels found for user");
      setData([]);
      return;
    }
    
    const vesselIds = userVessels.map(v => v.vessel_id);
    const vesselsMap = userVessels.reduce((acc, v) => {
      if (v.vessels) {
        acc[v.vessel_id] = v.vessels.vessel_name;
      }
      return acc;
    }, {});

    // Second fetch - Get defects
    console.log("Fetching defects for vessels:", vesselIds);
    
    const { data: defects, error: defectsError } = await supabase
      .from('defects register')
      .select('*')
      .eq('is_deleted', false)
      .in('vessel_id', vesselIds)
      .order('Date Reported', { ascending: false });

    if (defectsError) {
      console.error("Defects fetch error:", defectsError);
      throw defectsError;
    }

    console.log("Fetched defects:", defects);

    // Ensure files arrays exist
    const processedDefects = (defects || []).map(defect => ({
      ...defect,
      before_files: defect.before_files || [],
      after_files: defect.after_files || []
    }));

    setAssignedVessels(vesselIds);
    setVesselNames(vesselsMap);
    setData(processedDefects);
    
  } catch (error) {
    console.error("Error in fetchUserData:", error);
    toast({
      title: "Error",
      description: error.message || "Failed to fetch data",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
}, [session?.user?.id, toast]);

  const filteredData = React.useMemo(() => {
    return data.filter(defect => {
      const defectDate = new Date(defect['Date Reported']);
      const matchesVessel = currentVessel.length === 0 || currentVessel.includes(defect.vessel_id);
      const matchesStatus = !statusFilter || defect['Status (Vessel)'] === statusFilter;
      const matchesCriticality = !criticalityFilter || defect.Criticality === criticalityFilter;
      const matchesSearch = !searchTerm || 
        Object.values(defect).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesDateRange = 
        (!dateRange.from || defectDate >= new Date(dateRange.from)) &&
        (!dateRange.to || defectDate <= new Date(dateRange.to));

      return matchesVessel && matchesStatus && matchesCriticality && matchesSearch && matchesDateRange;
    });
  }, [data, currentVessel, statusFilter, criticalityFilter, searchTerm, dateRange]);

  const handleGeneratePdf = useCallback(async () => {
    setIsPdfGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPdfGenerating(false);
    }
  }, [toast]);

  const handleAddDefect = () => {
    if (assignedVessels.length === 0) {
      toast({
        title: "Error",
        description: "No vessels assigned to you. Contact administrator.",
        variant: "destructive",
      });
      return;
    }

    setCurrentDefect({
      id: `temp-${Date.now()}`,
      SNo: data.length + 1,
      vessel_id: '',
      Equipments: '',
      Description: '',
      'Action Planned': '',
      Criticality: '',
      'Status (Vessel)': 'OPEN',
      'Date Reported': new Date().toISOString().split('T')[0],
      'Date Completed': '',
      files: []
    });
    setIsDefectDialogOpen(true);
  };

  const handleDeleteFile = async (defectId, fileIndex) => {
  try {
    const defect = data.find(d => d.id === defectId);
    if (!defect || !defect.files?.[fileIndex]) return;

    const fileToDelete = defect.files[fileIndex];

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('defect-files')
      .remove([fileToDelete.path]);

    if (storageError) throw storageError;

    // Update defect record
    const updatedFiles = defect.files.filter((_, index) => index !== fileIndex);
    const { error: updateError } = await supabase
      .from('defects register')
      .update({ files: updatedFiles })
      .eq('id', defectId);

    if (updateError) throw updateError;

    // Update local state
    setData(prevData => prevData.map(d => {
      if (d.id === defectId) {
        return { ...d, files: updatedFiles };
      }
      return d;
    }));

    toast({
      title: "File Deleted",
      description: "File has been successfully removed",
    });

  } catch (error) {
    console.error("Error deleting file:", error);
    toast({
      title: "Error",
      description: "Failed to delete file",
      variant: "destructive",
    });
  }
};
  
  const handleSaveDefect = async (updatedDefect, newFiles) => {
    try {
      if (!assignedVessels.includes(updatedDefect.vessel_id)) {
        throw new Error("Not authorized for this vessel");
      }

      const isNewDefect = updatedDefect.id?.startsWith('temp-');
      
      // Upload files if any
      let uploadedFiles = [];
      if (newFiles && newFiles.length > 0) {
        const filePromises = newFiles.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${updatedDefect.vessel_id}/${isNewDefect ? 'new' : updatedDefect.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('defect-files')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('defect-files')
            .getPublicUrl(filePath);

          return {
            name: file.name,
            url: publicUrl,
            path: filePath
          };
        });

        uploadedFiles = await Promise.all(filePromises);
      }

      const defectData = {
        vessel_id: updatedDefect.vessel_id,
        vessel_name: vesselNames[updatedDefect.vessel_id],
        "Status (Vessel)": updatedDefect['Status (Vessel)'],
        Equipments: updatedDefect.Equipments,
        Description: updatedDefect.Description,
        "Action Planned": updatedDefect['Action Planned'],
        Criticality: updatedDefect.Criticality,
        "Date Reported": updatedDefect['Date Reported'],
        "Date Completed": updatedDefect['Date Completed'] || null,
        Comments: updatedDefect.Comments || '',
        files: [...(updatedDefect.files || []), ...uploadedFiles]
      };

      let result;
      if (isNewDefect) {
        const { data: insertedData, error: insertError } = await supabase
          .from('defects register')
          .insert([defectData])
          .select('*')
          .single();

        if (insertError) throw insertError;
        result = insertedData;
        
        setData(prevData => [result, ...prevData]);
      } else {
        const { data: updatedData, error: updateError } = await supabase
          .from('defects register')
          .update(defectData)
          .eq('id', updatedDefect.id)
          .select('*')
          .single();

        if (updateError) throw updateError;
        result = updatedData;
        
        setData(prevData => {
          const updatedData = prevData.map(d => d.id === result.id ? result : d);
          return [...updatedData].sort((a, b) => 
            new Date(b['Date Reported']) - new Date(a['Date Reported'])
          );
        });
      }

      toast({
        title: isNewDefect ? "Defect Added" : "Defect Updated",
        description: "Successfully saved the defect",
      });

      setIsDefectDialogOpen(false);
      setCurrentDefect(null);

    } catch (error) {
      console.error("Error saving defect:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save defect",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDefect = async (defectId) => {
    try {
      if (!session?.user?.id) {
        throw new Error("User not authenticated");
      }

      const confirmed = window.confirm("Are you sure you want to delete this defect?");
      if (!confirmed) return;

      setLoading(true);

      const { error } = await supabase
        .from('defects register')
        .update({
          is_deleted: true,
          deleted_by: session.user.id,
          deleted_at: new Date().toISOString()
        })
        .eq('id', defectId);

      if (error) throw error;

      setData(prevData => prevData.filter(d => d.id !== defectId));

      toast({
        title: "Defect Deleted",
        description: "Successfully deleted the defect record",
      });

    } catch (error) {
      console.error("Error deleting defect:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete defect",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getSelectedVesselsDisplay = () => {
    if (currentVessel.length === 0) return 'All Vessels';
    if (currentVessel.length === 1) {
      return vesselNames[currentVessel[0]] || 'All Vessels';
    }
    return `${currentVessel.length} Vessels Selected`;
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        {session ? (
          <>
            <Header 
              user={session.user}
              vessels={Object.entries(vesselNames)}
              currentVessel={currentVessel}
              onVesselChange={setCurrentVessel}
              onLogout={handleLogout}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
            
            <main className="container mx-auto pt-20">
              <StatsCards data={filteredData} />
              
              <SearchBar 
                onSearch={setSearchTerm}
                onFilterStatus={setStatusFilter}
                onFilterCriticality={setCriticalityFilter}
                status={statusFilter}
                criticality={criticalityFilter}
              />
              
              <DefectsTable
                data={filteredData}
                onAddDefect={handleAddDefect}
                onEditDefect={(defect) => {
                  setCurrentDefect(defect);
                  setIsDefectDialogOpen(true);
                }}
                onDeleteDefect={handleDeleteDefect}
                loading={loading}
              />

              <DefectDialog
                isOpen={isDefectDialogOpen}
                onClose={() => {
                  setIsDefectDialogOpen(false);
                  setCurrentDefect(null);
                }}
                defect={currentDefect}
                onChange={(field, value) => 
                  setCurrentDefect(prev => ({ ...prev, [field]: value }))
                }
                onSave={handleSaveDefect}
                vessels={vesselNames}
                isNew={currentDefect?.id?.startsWith('temp-')}
              />

              <ChatBot 
                data={filteredData}
                vesselName={getSelectedVesselsDisplay()}
                filters={{
                  status: statusFilter,
                  criticality: criticalityFilter,
                  search: searchTerm
                }}
                isPdfGenerating={isPdfGenerating}
                onGeneratePdf={handleGeneratePdf}
              />
            </main>
          </>
        ) : (
          <Auth onLogin={setSession} />
        )}
      </div>
    </ToastProvider>
  );
}

export default App;
