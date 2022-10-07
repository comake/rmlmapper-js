export abstract class SourceParser {
  /**
  * Get the total count of items in the dataset
  */
  public abstract getCount(): number;
  /**
  * Get the data at a specific index matching a selector
  * @param index - the index of the data to get
  * @param selector - the selector of the field to get from the data at the index
  */
  public abstract getData(index: number, selector: string): any[];
}
