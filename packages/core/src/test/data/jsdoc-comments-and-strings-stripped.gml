                                            
                                                                                 
function preimport(){

}

Script1();

Script2_v3();                  
                                    
                      
function get_list_of_files_in_directory() {

        var the_directory               = argument[0];
        var use_total_file_path = argument_count > 1 ? argument[1] : false;
        var attribute                   = argument_count > 2 ? argument[2] : 0;

        var files_list = ds_list_create();

                                                            
        if directory_exists(the_directory) {
                var f = file_find_first(the_directory + "   ", attribute);
                while f != "" {
                        if use_total_file_path {
                                var total_path = the_directory + "        " + f;
                                ds_list_add(files_list, total_path);
                        }
                        else ds_list_add(files_list, f);
                                                             
                    f = file_find_next();
                }
                file_find_close();
        }

        return files_list;


}