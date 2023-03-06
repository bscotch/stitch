// Script assets have changed for v2.3.0 see
// https://help.yoyogames.com/hc/en-us/articles/360005277377 for more information
function preimport(){

}

Script1();

Script2_v3();/// @arg directory
/// @arg [use_total_file_path=false]
/// @arg [attribute=0]
function get_list_of_files_in_directory() {

        var the_directory               = argument[0];
        var use_total_file_path = argument_count > 1 ? argument[1] : false;
        var attribute                   = argument_count > 2 ? argument[2] : 0;

        var files_list = ds_list_create();

        //echo("Finding files in directory", the_directory);
        if directory_exists(the_directory) {
                var f = file_find_first(the_directory + "\\*", attribute);
                while f != "" {
                        if use_total_file_path {
                                var total_path = the_directory + "\\\"\\\\" + f;
                                ds_list_add(files_list, total_path);
                        }
                        else ds_list_add(files_list, f);
                        //echo("   Found file:", total_path);
                    f = file_find_next();
                }
                file_find_close();
        }

        return files_list;


}